import Link from 'next/link'

/**
 * Daftar periksa yang membaca keadaan akun yang sedang dibuka.
 *
 * Panduan yang hanya berisi teks umum membuat pembaca harus menebak sendiri
 * sudah sampai mana. Di sini status tiap langkah dibaca dari data nyata, jadi
 * pembaca non-teknis cukup mengerjakan yang masih bertanda belum.
 */

export type ChecklistItem = {
  id: string
  title: string
  done: boolean
  doneNote: string
  todoNote: string
  href: string
  hrefLabel: string
}

export default function SetupChecklist({ items }: { items: ChecklistItem[] }) {
  const remaining = items.filter((item) => !item.done).length

  return (
    <div className="checklist">
      <div className="checklist-head">
        <h3>Persiapanmu sejauh ini</h3>
        <span className="checklist-count">
          {remaining === 0
            ? 'Semua beres'
            : `${remaining} dari ${items.length} belum selesai`}
        </span>
      </div>

      <ul>
        {items.map((item) => (
          <li key={item.id} className={item.done ? 'check-row check-done' : 'check-row'}>
            <span className="check-mark" aria-hidden>
              {item.done ? '✓' : '·'}
            </span>
            <div className="check-body">
              <p className="check-title">
                {item.title}
                <span className="visually-hidden">
                  {item.done ? ' — sudah selesai' : ' — belum selesai'}
                </span>
              </p>
              <p className="check-note">{item.done ? item.doneNote : item.todoNote}</p>
            </div>
            {item.done ? null : (
              <Link href={item.href} className="btn btn-quiet check-action">
                {item.hrefLabel}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
