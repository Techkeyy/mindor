'use client'
import { useEffect, useRef } from 'react'

interface ThreadsProps {
  color?: [number, number, number]
  amplitude?: number
  distance?: number
  enableMouseInteraction?: boolean
}

export default function Threads({
  color = [45, 212, 191],
  amplitude = 1,
  distance = 0,
  enableMouseInteraction = true,
}: ThreadsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    let mouse = { x: 0, y: 0 }

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    window.addEventListener('resize', resize)

    if (enableMouseInteraction) {
      canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect()
        mouse.x = e.clientX - rect.left
        mouse.y = e.clientY - rect.top
      })
    }

    const THREAD_COUNT = 18
    const threads = Array.from({ length: THREAD_COUNT }, (_, i) => ({
      y: (canvas.height / THREAD_COUNT) * i,
      offset: Math.random() * Math.PI * 2,
      speed: 0.0003 + Math.random() * 0.0004,
      width: 0.5 + Math.random() * 1.2,
      opacity: 0.08 + Math.random() * 0.18,
    }))

    let t = 0
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      t += 1

      threads.forEach((thread) => {
        ctx.beginPath()
        ctx.lineWidth = thread.width

        const [r, g, b] = color
        ctx.strokeStyle = 
          `rgba(${r},${g},${b},${thread.opacity})`

        const points = 120
        for (let i = 0; i <= points; i++) {
          const x = (canvas.width / points) * i
          const wave1 = Math.sin(
            i * 0.05 + t * thread.speed * 1000 + thread.offset
          ) * 60 * amplitude
          const wave2 = Math.sin(
            i * 0.02 + t * thread.speed * 600
          ) * 30 * amplitude

          let mouseEffect = 0
          if (enableMouseInteraction && mouse.x) {
            const dx = x - mouse.x
            const dy = thread.y - mouse.y
            const dist = Math.sqrt(dx * dx + dy * dy)
            if (dist < 200) {
              mouseEffect = (1 - dist / 200) * 40
            }
          }

          const y = thread.y + wave1 + wave2 
                    + mouseEffect + distance

          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
      })

      animId = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [color, amplitude, distance, enableMouseInteraction])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%' }}
    />
  )
}