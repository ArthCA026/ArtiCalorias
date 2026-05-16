export default function EmptyState({ message = 'Nothing here yet.' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-6 sm:py-10 text-center">
      <p className="text-sm text-gray-400">{message}</p>
    </div>
  );
}
