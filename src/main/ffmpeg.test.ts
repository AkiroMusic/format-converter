/**
 * Format Converter
 * Copyright (c) 2026 Akiro. All rights reserved.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventEmitter } from 'events'

// Mock child_process
vi.mock('child_process', () => ({
  spawn: vi.fn()
}))

import { spawn } from 'child_process'
import { runFfmpeg, probeDuration, run } from './ffmpeg'

// Helper to create a mock child process
function createMockProcess(): EventEmitter & { stdout: EventEmitter; stderr: EventEmitter; kill: ReturnType<typeof vi.fn> } {
  const proc = new EventEmitter() as any
  proc.stdout = new EventEmitter()
  proc.stderr = new EventEmitter()
  proc.kill = vi.fn()
  proc.pid = 12345
  return proc
}

describe('runFfmpeg', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should spawn ffmpeg with given args', async () => {
    const mockProc = createMockProcess()
    vi.mocked(spawn).mockReturnValue(mockProc as any)

    const promise = runFfmpeg(['-i', 'input.mp3', 'output.wav'])

    mockProc.emit('close', 0)

    await promise

    expect(spawn).toHaveBeenCalledWith('ffmpeg', ['-i', 'input.mp3', 'output.wav'], expect.any(Object))
  })

  it('should collect stderr output', async () => {
    const mockProc = createMockProcess()
    vi.mocked(spawn).mockReturnValue(mockProc as any)

    const promise = runFfmpeg(['-i', 'input.mp3', 'output.wav'])

    mockProc.stderr.emit('data', Buffer.from('some stderr output'))
    mockProc.emit('close', 0)

    const result = await promise
    expect(result.stderr).toContain('some stderr output')
  })

  it('should reject on non-zero exit code', async () => {
    const mockProc = createMockProcess()
    vi.mocked(spawn).mockReturnValue(mockProc as any)

    const promise = runFfmpeg(['-i', 'input.mp3', 'output.wav'])

    mockProc.stderr.emit('data', Buffer.from('error: something failed'))
    mockProc.emit('close', 1)

    await expect(promise).rejects.toThrow('ffmpeg exited 1')
  })

  it('should reject on spawn error', async () => {
    const mockProc = createMockProcess()
    vi.mocked(spawn).mockReturnValue(mockProc as any)

    const promise = runFfmpeg(['-i', 'input.mp3', 'output.wav'])

    mockProc.emit('error', new Error('ENOENT'))

    await expect(promise).rejects.toThrow('ENOENT')
  })

  it('should kill process on abort', async () => {
    const mockProc = createMockProcess()
    vi.mocked(spawn).mockReturnValue(mockProc as any)

    const controller = new AbortController()
    const promise = runFfmpeg(['-i', 'input.mp3', 'output.wav'], { signal: controller.signal })

    controller.abort()
    mockProc.emit('close', null)

    await expect(promise).rejects.toThrow('aborted')
    expect(mockProc.kill).toHaveBeenCalled()
  })

  it('should parse time progress from stderr with throttling', async () => {
    vi.useFakeTimers()
    const mockProc = createMockProcess()
    vi.mocked(spawn).mockReturnValue(mockProc as any)

    const onProgress = vi.fn()
    const promise = runFfmpeg(['-i', 'input.mp3', 'output.wav'], {
      onProgress,
      totalDurationSec: 100
    })

    // First data event: time=10s → 10%
    mockProc.stderr.emit('data', Buffer.from('time=00:00:10.00'))
    // Advance past the 200ms throttle window
    vi.advanceTimersByTime(250)

    // Second data event: time=50s → 50%
    mockProc.stderr.emit('data', Buffer.from('time=00:00:50.00'))
    vi.advanceTimersByTime(250)

    mockProc.emit('close', 0)
    await promise

    expect(onProgress).toHaveBeenCalledTimes(2)
    expect(onProgress.mock.calls[0][0]).toBeCloseTo(10, 0)
    expect(onProgress.mock.calls[1][0]).toBeCloseTo(50, 0)

    vi.useRealTimers()
  })
})

describe('probeDuration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should parse duration from ffprobe output', async () => {
    const mockProc = createMockProcess()
    vi.mocked(spawn).mockReturnValue(mockProc as any)

    const promise = probeDuration('test.mp3')

    mockProc.stdout.emit('data', Buffer.from('123.456'))
    mockProc.emit('close', 0)

    const duration = await promise
    expect(duration).toBeCloseTo(123.456)
  })

  it('should return 0 on invalid output', async () => {
    const mockProc = createMockProcess()
    vi.mocked(spawn).mockReturnValue(mockProc as any)

    const promise = probeDuration('test.mp3')

    mockProc.stdout.emit('data', Buffer.from('N/A'))
    mockProc.emit('close', 0)

    const duration = await promise
    expect(duration).toBe(0)
  })

  it('should return 0 on spawn error', async () => {
    const mockProc = createMockProcess()
    vi.mocked(spawn).mockReturnValue(mockProc as any)

    const promise = probeDuration('test.mp3')

    mockProc.emit('error', new Error('ENOENT'))

    const duration = await promise
    expect(duration).toBe(0)
  })
})

describe('run (high-level conversion)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function setupFormatTest() {
    const probeProc = createMockProcess()
    const ffmpegProc = createMockProcess()
    vi.mocked(spawn)
      .mockReturnValueOnce(probeProc as any)
      .mockReturnValueOnce(ffmpegProc as any)
    return { probeProc, ffmpegProc }
  }

  async function completeFormatTest(
    promise: Promise<unknown>,
    probeProc: EventEmitter & { stdout: EventEmitter; stderr: EventEmitter; kill: ReturnType<typeof vi.fn> },
    ffmpegProc: EventEmitter & { stdout: EventEmitter; stderr: EventEmitter; kill: ReturnType<typeof vi.fn> },
  ) {
    probeProc.stdout.emit('data', Buffer.from('120.5'))
    probeProc.emit('close', 0)
    // Emit ffmpeg close on next microtask so run() resumes from
    // probeDuration await and runFfmpeg registers its listener first
    await new Promise(process.nextTick)
    ffmpegProc.emit('close', 0)
    return promise
  }

  it('should perform full conversion pipeline', async () => {
    const probeProc = createMockProcess()
    const ffmpegProc = createMockProcess()
    vi.mocked(spawn)
      .mockReturnValueOnce(probeProc as any)
      .mockReturnValueOnce(ffmpegProc as any)

    const promise = run('/input/test.mp3', '/output/test.flac', { format: 'flac' })

    // Complete ffprobe probe
    probeProc.stdout.emit('data', Buffer.from('120.5'))
    probeProc.emit('close', 0)

    // Wait for run() to resume and call runFfmpeg before emitting
    await new Promise(process.nextTick)

    // Complete ffmpeg conversion
    ffmpegProc.emit('close', 0)

    const result = await promise
    expect(result.outputPath).toBe('/output/test.flac')
    expect(spawn).toHaveBeenCalledTimes(2)
  })

  it('should reject on ffmpeg conversion failure', async () => {
    const probeProc = createMockProcess()
    const ffmpegProc = createMockProcess()
    vi.mocked(spawn)
      .mockReturnValueOnce(probeProc as any)
      .mockReturnValueOnce(ffmpegProc as any)

    const promise = run('/input/test.mp3', '/output/test.flac', { format: 'flac' })

    probeProc.stdout.emit('data', Buffer.from('120.5'))
    probeProc.emit('close', 0)

    // Wait for run() to resume and call runFfmpeg before emitting
    await new Promise(process.nextTick)

    ffmpegProc.stderr.emit('data', Buffer.from('Conversion failed'))
    ffmpegProc.emit('close', 1)

    await expect(promise).rejects.toThrow(/ffmpeg exited|Conversion failed/)
  })

  // ---------------------------------------------------------------------------
  // Format-specific argument verification
  // ---------------------------------------------------------------------------

  it('should pass default mp3 codec and bitrate (320k) when format is mp3', async () => {
    const { probeProc, ffmpegProc } = setupFormatTest()
    const promise = run('/input/test.mp3', '/output/out.mp3', { format: 'mp3' })
    await completeFormatTest(promise, probeProc, ffmpegProc)

    const args = vi.mocked(spawn).mock.calls[1][1]
    expect(args).toContain('-codec:a')
    expect(args).toContain('libmp3lame')
    expect(args).toContain('-b:a')
    expect(args).toContain('320k')
  })

  it('should pass custom bitrate for lossy mp3 format', async () => {
    const { probeProc, ffmpegProc } = setupFormatTest()
    const promise = run('/input/test.mp3', '/output/out.mp3', { format: 'mp3', bitrate: '128k' })
    await completeFormatTest(promise, probeProc, ffmpegProc)

    const args = vi.mocked(spawn).mock.calls[1][1]
    const idx = args.indexOf('-b:a')
    expect(args[idx + 1]).toBe('128k')
  })

  it('should pass vbr quality flag (-q:a) for mp3', async () => {
    const { probeProc, ffmpegProc } = setupFormatTest()
    const promise = run('/input/test.mp3', '/output/out.mp3', { format: 'mp3', vbr: 5 })
    await completeFormatTest(promise, probeProc, ffmpegProc)

    const args = vi.mocked(spawn).mock.calls[1][1]
    expect(args).toContain('-q:a')
    const idx = args.indexOf('-q:a')
    expect(args[idx + 1]).toBe('5')
  })

  it('should pass joint stereo flag for mp3', async () => {
    const { probeProc, ffmpegProc } = setupFormatTest()
    const promise = run('/input/test.mp3', '/output/out.mp3', { format: 'mp3', jointStereo: true })
    await completeFormatTest(promise, probeProc, ffmpegProc)

    const args = vi.mocked(spawn).mock.calls[1][1]
    expect(args).toContain('-joint_stereo')
    const idx = args.indexOf('-joint_stereo')
    expect(args[idx + 1]).toBe('1')
  })

  it('should pass flac codec with compression level and bit depth args', async () => {
    const { probeProc, ffmpegProc } = setupFormatTest()
    const promise = run('/input/test.flac', '/output/out.flac', {
      format: 'flac',
      compressionLevel: 8,
      bitDepth: 24,
    })
    await completeFormatTest(promise, probeProc, ffmpegProc)

    const args = vi.mocked(spawn).mock.calls[1][1]
    expect(args).toContain('-codec:a')
    expect(args).toContain('flac')
    expect(args).toContain('-compression_level')
    const ci = args.indexOf('-compression_level')
    expect(args[ci + 1]).toBe('8')
    // FLAC stores 24-bit as s32
    expect(args).toContain('-sample_fmt')
    const fi = args.indexOf('-sample_fmt')
    expect(args[fi + 1]).toBe('s32')
  })

  it('should pass flac with s16 sample_fmt for 16-bit depth', async () => {
    const { probeProc, ffmpegProc } = setupFormatTest()
    const promise = run('/input/test.flac', '/output/out.flac', {
      format: 'flac',
      bitDepth: 16,
    })
    await completeFormatTest(promise, probeProc, ffmpegProc)

    const args = vi.mocked(spawn).mock.calls[1][1]
    const fi = args.indexOf('-sample_fmt')
    expect(args[fi + 1]).toBe('s16')
  })

  it('should pass opus codec with default bitrate 192k', async () => {
    const { probeProc, ffmpegProc } = setupFormatTest()
    const promise = run('/input/test.opus', '/output/out.opus', { format: 'opus' })
    await completeFormatTest(promise, probeProc, ffmpegProc)

    const args = vi.mocked(spawn).mock.calls[1][1]
    expect(args).toContain('-codec:a')
    expect(args).toContain('libopus')
    expect(args).toContain('-b:a')
    const bi = args.indexOf('-b:a')
    expect(args[bi + 1]).toBe('192k')
  })

  it('should pass vbr on/off flag for opus format', async () => {
    const { probeProc, ffmpegProc } = setupFormatTest()
    const promise = run('/input/test.opus', '/output/out.opus', { format: 'opus', vbr: 1 })
    await completeFormatTest(promise, probeProc, ffmpegProc)

    const args = vi.mocked(spawn).mock.calls[1][1]
    expect(args).toContain('-vbr')
    const idx = args.indexOf('-vbr')
    expect(args[idx + 1]).toBe('1')
  })

  it('should select pcm codec based on bit depth for wav format', async () => {
    const { probeProc, ffmpegProc } = setupFormatTest()
    const promise = run('/input/test.wav', '/output/out.wav', { format: 'wav', bitDepth: 24 })
    await completeFormatTest(promise, probeProc, ffmpegProc)

    const args = vi.mocked(spawn).mock.calls[1][1]
    expect(args).toContain('-codec:a')
    expect(args).toContain('pcm_s24le')
  })

  it('should default wav to pcm_s16le when no bit depth specified', async () => {
    const { probeProc, ffmpegProc } = setupFormatTest()
    const promise = run('/input/test.wav', '/output/out.wav', { format: 'wav' })
    await completeFormatTest(promise, probeProc, ffmpegProc)

    const args = vi.mocked(spawn).mock.calls[1][1]
    const ci = args.indexOf('-codec:a')
    expect(args[ci + 1]).toBe('pcm_s16le')
  })

  it('should use pcm_f32le for wav with 32-bit depth', async () => {
    const { probeProc, ffmpegProc } = setupFormatTest()
    const promise = run('/input/test.wav', '/output/out.wav', { format: 'wav', bitDepth: 32 })
    await completeFormatTest(promise, probeProc, ffmpegProc)

    const args = vi.mocked(spawn).mock.calls[1][1]
    const ci = args.indexOf('-codec:a')
    expect(args[ci + 1]).toBe('pcm_f32le')
  })

  it('should pass sample rate as -ar when specified', async () => {
    const { probeProc, ffmpegProc } = setupFormatTest()
    const promise = run('/input/test.mp3', '/output/out.mp3', {
      format: 'flac',
      sampleRate: 48000,
    })
    await completeFormatTest(promise, probeProc, ffmpegProc)

    const args = vi.mocked(spawn).mock.calls[1][1]
    expect(args).toContain('-ar')
    const idx = args.indexOf('-ar')
    expect(args[idx + 1]).toBe('48000')
  })

  it('should default format to mp3 when not specified', async () => {
    const { probeProc, ffmpegProc } = setupFormatTest()
    const promise = run('/input/test.mp3', '/output/out.mp3')
    await completeFormatTest(promise, probeProc, ffmpegProc)

    const args = vi.mocked(spawn).mock.calls[1][1]
    expect(args).toContain('-codec:a')
    expect(args).toContain('libmp3lame')
    expect(args).toContain('-b:a')
    expect(args).toContain('320k')
  })
})


