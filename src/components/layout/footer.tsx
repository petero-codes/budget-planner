export function Footer() {
  return (
    <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-400/30 bg-white px-4 py-2 text-meta text-neutral-700">
      <span>© KenGen · ICT Budgeting Portal</span>
      <span>Internal — KenGen Confidential · v0.1.0</span>
      <a href="#" className="text-kengen-blue hover:underline">
        Report an issue
      </a>
    </footer>
  );
}
