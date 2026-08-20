'use client'

import { useRef, useState } from 'react'
import { formatRupiahInput } from '@/lib/core/format'

/**
 * Field uang yang selalu tampil sebagai rupiah ("Rp 1.500.000").
 * Nilai yang terkirim tetap berupa teks berformat; server sudah
 * menyaring digitnya sendiri lewat `parseAmount`/`positiveInt`.
 */
export default function MoneyInput({
  name,
  defaultValue,
  placeholder = 'Rp 0',
  required,
  className,
  id,
}: {
  name: string
  defaultValue?: number | string
  placeholder?: string
  required?: boolean
  className?: string
  id?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState(() => formatRupiahInput(String(defaultValue ?? '')))

  // Jumlah digit sebelum kursor dipakai untuk mengembalikan posisi kursor
  // setelah titik ribuan disisipkan ulang.
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.target
    const caret = input.selectionStart ?? input.value.length
    const digitsBeforeCaret = input.value.slice(0, caret).replace(/[^\d]/g, '').length
    const next = formatRupiahInput(input.value)
    setValue(next)

    requestAnimationFrame(() => {
      const node = ref.current
      if (!node) return
      let seen = 0
      let position = next.length
      for (let index = 0; index < next.length; index += 1) {
        if (/\d/.test(next[index])) {
          seen += 1
          if (seen === digitsBeforeCaret) {
            position = index + 1
            break
          }
        }
      }
      if (digitsBeforeCaret === 0) position = next.length
      node.setSelectionRange(position, position)
    })
  }

  return (
    <input
      ref={ref}
      id={id}
      className={className}
      name={name}
      value={value}
      onChange={handleChange}
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder}
      required={required}
    />
  )
}
