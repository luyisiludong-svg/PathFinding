import { useCallback, useMemo, useRef, useState } from 'react'
import './App.css'

const algorithms = ['Dijkstra', 'A*', 'BFS', 'DFS'] as const
const tools = ['Wall', 'Start', 'Target', 'Erase'] as const

type Algorithm = (typeof algorithms)[number]
type Tool = (typeof tools)[number]
type Point = { row: number; col: number }
type ParentMap = Map<string, string | null>
type SearchResult = { visited: string[]; path: string[] }

const initialRows = 21
const initialCols = 39

const keyOf = (point: Point) => `${point.row}-${point.col}`

const pointFromKey = (key: string): Point => {
  const [row, col] = key.split('-').map(Number)
  return { row, col }
}

const samePoint = (a: Point, b: Point) => a.row === b.row && a.col === b.col

const getNeighbors = (point: Point, rows: number, cols: number) => {
  const directions = [
    { row: -1, col: 0 },
    { row: 0, col: 1 },
    { row: 1, col: 0 },
    { row: 0, col: -1 },
  ]

  return directions
    .map((direction) => ({
      row: point.row + direction.row,
      col: point.col + direction.col,
    }))
    .filter(
      (next) =>
        next.row >= 0 && next.row < rows && next.col >= 0 && next.col < cols,
    )
}

const heuristic = (a: Point, b: Point) =>
  Math.abs(a.row - b.row) + Math.abs(a.col - b.col)

const buildPath = (parents: ParentMap, targetKey: string) => {
  if (!parents.has(targetKey)) return []

  const path: string[] = []
  let current: string | null | undefined = targetKey
  while (current) {
    path.unshift(current)
    current = parents.get(current)
  }

  return path
}

const runUnweightedSearch = (
  mode: 'BFS' | 'DFS',
  start: Point,
  target: Point,
  walls: Set<string>,
  rows: number,
  cols: number,
): SearchResult => {
  const startKey = keyOf(start)
  const targetKey = keyOf(target)
  const frontier = [start]
  const seen = new Set([startKey])
  const parents: ParentMap = new Map([[startKey, null]])
  const visited: string[] = []

  while (frontier.length > 0) {
    const current = mode === 'BFS' ? frontier.shift() : frontier.pop()
    if (!current) break

    const currentKey = keyOf(current)
    visited.push(currentKey)
    if (currentKey === targetKey) break

    for (const neighbor of getNeighbors(current, rows, cols)) {
      const neighborKey = keyOf(neighbor)
      if (seen.has(neighborKey) || walls.has(neighborKey)) continue

      seen.add(neighborKey)
      parents.set(neighborKey, currentKey)
      frontier.push(neighbor)
    }
  }

  return { visited, path: buildPath(parents, targetKey) }
}

const runWeightedSearch = (
  mode: 'Dijkstra' | 'A*',
  start: Point,
  target: Point,
  walls: Set<string>,
  rows: number,
  cols: number,
): SearchResult => {
  const startKey = keyOf(start)
  const targetKey = keyOf(target)
  const distances = new Map<string, number>([[startKey, 0]])
  const parents: ParentMap = new Map([[startKey, null]])
  const visited = new Set<string>()
  const order: string[] = []
  const queue = [{ point: start, priority: 0 }]

  while (queue.length > 0) {
    queue.sort((a, b) => a.priority - b.priority)
    const { point: current } = queue.shift()!
    const currentKey = keyOf(current)
    if (visited.has(currentKey)) continue

    visited.add(currentKey)
    order.push(currentKey)
    if (currentKey === targetKey) break

    const currentDistance = distances.get(currentKey) ?? Number.POSITIVE_INFINITY
    for (const neighbor of getNeighbors(current, rows, cols)) {
      const neighborKey = keyOf(neighbor)
      if (walls.has(neighborKey) || visited.has(neighborKey)) continue

      const nextDistance = currentDistance + 1
      if (nextDistance >= (distances.get(neighborKey) ?? Number.POSITIVE_INFINITY)) {
        continue
      }

      distances.set(neighborKey, nextDistance)
      parents.set(neighborKey, currentKey)
      const priority =
        mode === 'A*' ? nextDistance + heuristic(neighbor, target) : nextDistance
      queue.push({ point: neighbor, priority })
    }
  }

  return { visited: order, path: buildPath(parents, targetKey) }
}

const runSearch = (
  algorithm: Algorithm,
  start: Point,
  target: Point,
  walls: Set<string>,
  rows: number,
  cols: number,
) => {
  if (algorithm === 'BFS' || algorithm === 'DFS') {
    return runUnweightedSearch(algorithm, start, target, walls, rows, cols)
  }

  return runWeightedSearch(algorithm, start, target, walls, rows, cols)
}

const createMaze = (rows: number, cols: number, start: Point, target: Point) => {
  const maze = new Set<string>()

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const point = { row, col }
      if (samePoint(point, start) || samePoint(point, target)) continue

      const isRail = row % 4 === 2 && col > 1 && col < cols - 2
      const hasGate = col % 9 === 4
      const isScatter = (row * 17 + col * 31) % 23 === 0
      if ((isRail && !hasGate) || isScatter) maze.add(keyOf(point))
    }
  }

  return maze
}

function App() {
  const [rows, setRows] = useState(initialRows)
  const [cols, setCols] = useState(initialCols)
  const [algorithm, setAlgorithm] = useState<Algorithm>('Dijkstra')
  const [tool, setTool] = useState<Tool>('Wall')
  const [speed, setSpeed] = useState(12)
  const [start, setStart] = useState<Point>({ row: 10, col: 7 })
  const [target, setTarget] = useState<Point>({ row: 10, col: 31 })
  const [walls, setWalls] = useState<Set<string>>(() => new Set())
  const [visited, setVisited] = useState<Set<string>>(() => new Set())
  const [path, setPath] = useState<Set<string>>(() => new Set())
  const [isDrawing, setIsDrawing] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [stats, setStats] = useState({ visited: 0, path: 0 })
  const runId = useRef(0)

  const cells = useMemo(
    () =>
      Array.from({ length: rows * cols }, (_, index) => ({
        row: Math.floor(index / cols),
        col: index % cols,
      })),
    [cols, rows],
  )

  const clearSearch = useCallback(() => {
    runId.current += 1
    setIsRunning(false)
    setVisited(new Set())
    setPath(new Set())
    setStats({ visited: 0, path: 0 })
  }, [])

  const clampPointsToGrid = useCallback((nextRows: number, nextCols: number) => {
    setStart((current) => ({
      row: Math.min(current.row, nextRows - 1),
      col: Math.min(current.col, nextCols - 1),
    }))
    setTarget((current) => ({
      row: Math.min(current.row, nextRows - 1),
      col: Math.min(current.col, nextCols - 1),
    }))
    setWalls(
      (current) =>
        new Set(
          [...current].filter((cellKey) => {
            const point = pointFromKey(cellKey)
            return point.row < nextRows && point.col < nextCols
          }),
        ),
    )
  }, [])

  const paintCell = useCallback(
    (point: Point) => {
      if (isRunning) return

      const cellKey = keyOf(point)
      clearSearch()

      if (tool === 'Start') {
        if (samePoint(point, target)) return
        setStart(point)
        setWalls((current) => {
          const next = new Set(current)
          next.delete(cellKey)
          return next
        })
        return
      }

      if (tool === 'Target') {
        if (samePoint(point, start)) return
        setTarget(point)
        setWalls((current) => {
          const next = new Set(current)
          next.delete(cellKey)
          return next
        })
        return
      }

      if (samePoint(point, start) || samePoint(point, target)) return

      setWalls((current) => {
        const next = new Set(current)
        if (tool === 'Erase') {
          next.delete(cellKey)
        } else {
          next.add(cellKey)
        }
        return next
      })
    },
    [clearSearch, isRunning, start, target, tool],
  )

  const visualize = async () => {
    if (isRunning) return

    const currentRun = runId.current + 1
    runId.current = currentRun
    setIsRunning(true)
    setVisited(new Set())
    setPath(new Set())
    setStats({ visited: 0, path: 0 })

    const result = runSearch(algorithm, start, target, walls, rows, cols)
    const delay = Math.max(4, 34 - speed * 2)

    for (const cellKey of result.visited) {
      if (runId.current !== currentRun) return
      setVisited((current) => new Set(current).add(cellKey))
      setStats((current) => ({ ...current, visited: current.visited + 1 }))
      await new Promise((resolve) => setTimeout(resolve, delay))
    }

    for (const cellKey of result.path) {
      if (runId.current !== currentRun) return
      setPath((current) => new Set(current).add(cellKey))
      setStats((current) => ({ ...current, path: current.path + 1 }))
      await new Promise((resolve) => setTimeout(resolve, delay * 1.8))
    }

    if (runId.current === currentRun) setIsRunning(false)
  }

  const resetBoard = () => {
    clearSearch()
    setWalls(new Set())
  }

  const addMaze = () => {
    clearSearch()
    setWalls(createMaze(rows, cols, start, target))
  }

  const handleRowsChange = (value: number) => {
    clearSearch()
    setRows(value)
    clampPointsToGrid(value, cols)
  }

  const handleColsChange = (value: number) => {
    clearSearch()
    setCols(value)
    clampPointsToGrid(rows, value)
  }

  return (
    <main className="app-shell" onPointerUp={() => setIsDrawing(false)}>
      <header className="topbar">
        <div>
          <p className="eyebrow">Pathfinding Algorithm Visualizer</p>
          <h1>Explore how search algorithms make decisions.</h1>
        </div>
        <button className="primary-action" type="button" onClick={visualize}>
          {isRunning ? 'Running...' : `Run ${algorithm}`}
        </button>
      </header>

      <section className="control-strip" aria-label="Visualizer controls">
        <div className="control-group algorithm-group">
          <span>Algorithm</span>
          <div className="segmented">
            {algorithms.map((option) => (
              <button
                className={algorithm === option ? 'active' : ''}
                key={option}
                type="button"
                onClick={() => {
                  clearSearch()
                  setAlgorithm(option)
                }}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <div className="control-group">
          <span>Tool</span>
          <div className="segmented compact">
            {tools.map((option) => (
              <button
                className={tool === option ? 'active' : ''}
                key={option}
                type="button"
                onClick={() => setTool(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <label className="range-control">
          <span>Speed</span>
          <input
            max="15"
            min="1"
            type="range"
            value={speed}
            onChange={(event) => setSpeed(Number(event.target.value))}
          />
        </label>

        <label className="range-control">
          <span>Rows</span>
          <input
            max="29"
            min="13"
            type="range"
            value={rows}
            onChange={(event) => handleRowsChange(Number(event.target.value))}
          />
        </label>

        <label className="range-control">
          <span>Columns</span>
          <input
            max="49"
            min="23"
            type="range"
            value={cols}
            onChange={(event) => handleColsChange(Number(event.target.value))}
          />
        </label>
      </section>

      <section className="workspace">
        <aside className="metrics" aria-label="Run metrics">
          <div>
            <span>Visited</span>
            <strong>{stats.visited}</strong>
          </div>
          <div>
            <span>Path Length</span>
            <strong>{stats.path}</strong>
          </div>
          <div>
            <span>Walls</span>
            <strong>{walls.size}</strong>
          </div>
          <div>
            <span>Grid</span>
            <strong>
              {rows} x {cols}
            </strong>
          </div>
        </aside>

        <div
          className="grid-board"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
          onPointerLeave={() => setIsDrawing(false)}
        >
          {cells.map((cell) => {
            const cellKey = keyOf(cell)
            const classes = ['cell']
            if (walls.has(cellKey)) classes.push('wall')
            if (visited.has(cellKey)) classes.push('visited')
            if (path.has(cellKey)) classes.push('path')
            if (samePoint(cell, start)) classes.push('start')
            if (samePoint(cell, target)) classes.push('target')

            return (
              <button
                aria-label={`Row ${cell.row + 1}, column ${cell.col + 1}`}
                className={classes.join(' ')}
                key={cellKey}
                type="button"
                onPointerDown={(event) => {
                  event.currentTarget.setPointerCapture(event.pointerId)
                  setIsDrawing(true)
                  paintCell(cell)
                }}
                onPointerEnter={() => {
                  if (isDrawing) paintCell(cell)
                }}
              />
            )
          })}
        </div>
      </section>

      <footer className="action-row">
        <button type="button" onClick={addMaze}>
          Generate Maze
        </button>
        <button type="button" onClick={clearSearch}>
          Clear Search
        </button>
        <button type="button" onClick={resetBoard}>
          Clear Board
        </button>
      </footer>
    </main>
  )
}

export default App
