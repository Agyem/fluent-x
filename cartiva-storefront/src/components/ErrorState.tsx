export default function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-8 text-center">
      <p className="font-semibold">Something went wrong</p>
      <p className="text-sm text-zinc-500 mt-1">{message}</p>
      {onRetry && <button onClick={onRetry} className="mt-4 px-4 py-2 rounded-xl bg-zinc-900 text-white text-sm font-semibold">Try again</button>}
    </div>
  )
}
