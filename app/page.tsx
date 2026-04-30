import { SupportChat } from "@/components/SupportChat";

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center bg-zinc-50 px-4 py-12 dark:bg-zinc-950">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Meridian Electronics
        </h1>
        <p className="mt-2 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
          Support chat — products, availability, and orders via our assistant.
        </p>
      </div>
      <SupportChat />
    </div>
  );
}
