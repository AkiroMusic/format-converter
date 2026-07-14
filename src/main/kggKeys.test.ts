/**
 * Format Converter
 * Copyright (c) 2026 Akiro. All rights reserved.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { loadKeysMap, saveKeysMap } from './kggKeys'

describe('KGG key management — loadKeysMap / saveKeysMap', () => {
  let tempDir: string
  let keysPath: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'kgg-test-'))
    keysPath = join(tempDir, 'kgg.keys')
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('should return empty map when file does not exist', () => {
    const map = loadKeysMap(keysPath)
    expect(map.size).toBe(0)
  })

  it('should parse id$ekey format lines', () => {
    writeFileSync(keysPath, 'abc123$ekey_value_xyz\n', 'utf-8')
    const map = loadKeysMap(keysPath)
    expect(map.size).toBe(1)
    expect(map.get('abc123')).toBe('ekey_value_xyz')
  })

  it('should skip comment lines', () => {
    writeFileSync(keysPath, '# this is a comment\nabc123$ekey1\n', 'utf-8')
    const map = loadKeysMap(keysPath)
    expect(map.size).toBe(1)
  })

  it('should skip empty lines', () => {
    writeFileSync(keysPath, '\n\nabc123$ekey1\n\n', 'utf-8')
    const map = loadKeysMap(keysPath)
    expect(map.size).toBe(1)
  })

  it('should skip malformed lines without $ separator', () => {
    writeFileSync(keysPath, 'no_separator_here\nabc123$ekey1\n', 'utf-8')
    const map = loadKeysMap(keysPath)
    expect(map.size).toBe(1)
    expect(map.get('abc123')).toBe('ekey1')
  })

  it('should save and reload keys correctly', () => {
    const map = new Map<string, string>()
    map.set('id1', 'key1')
    map.set('id2', 'key2')

    saveKeysMap(keysPath, map)

    expect(existsSync(keysPath)).toBe(true)

    const loaded = loadKeysMap(keysPath)
    expect(loaded.size).toBe(2)
    expect(loaded.get('id1')).toBe('key1')
    expect(loaded.get('id2')).toBe('key2')
  })

  it('should sort keys by ID when saving', () => {
    const map = new Map<string, string>()
    map.set('z_id', 'z_val')
    map.set('a_id', 'a_val')

    saveKeysMap(keysPath, map)

    const content = readFileSync(keysPath, 'utf-8')
    const lines = content.trim().split('\n')
    expect(lines[0]).toBe('a_id$a_val')
    expect(lines[1]).toBe('z_id$z_val')
  })
})
