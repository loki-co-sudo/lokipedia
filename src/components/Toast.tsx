export default function Toast({ message }: { message: string }) {
  return (
    <div className="fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <div className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">{message}</div>
    </div>
  )
}
