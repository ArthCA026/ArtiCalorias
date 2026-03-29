import { SpinnerIcon } from "./icons";

interface SubmitButtonProps {
  loading: boolean;
  text: string;
  loadingText: string;
}

export default function SubmitButton({ loading, text, loadingText }: SubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
    >
      {loading && <SpinnerIcon />}
      {loading ? loadingText : text}
    </button>
  );
}
