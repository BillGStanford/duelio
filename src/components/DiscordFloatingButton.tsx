'use client';

export default function DiscordFloatingButton() {
  return (
    <a
      href="https://discord.gg/yyqm6gPWnS"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Join the Duelio Discord community"
      className="duelio-discord-float"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="currentColor">
        <path d="M19.7 5.3a18 18 0 0 0-4.4-1.4l-.6 1.2a16.7 16.7 0 0 0-5.4 0l-.6-1.2a18 18 0 0 0-4.4 1.4C1.5 9.4.7 13.4 1.1 17.4a18 18 0 0 0 5.4 2.7l1.2-1.9-1.9-.9.5-.4c3.7 1.7 7.7 1.7 11.4 0l.5.4-1.9.9 1.2 1.9a18 18 0 0 0 5.4-2.7c.5-4.6-.8-8.6-3.2-12.1ZM8.8 14.7c-1.1 0-2-1-2-2.2s.9-2.2 2-2.2 2 1 2 2.2-.9 2.2-2 2.2Zm6.4 0c-1.1 0-2-1-2-2.2s.9-2.2 2-2.2 2 1 2 2.2-.9 2.2-2 2.2Z"/>
      </svg>
      <span>Join the Discord</span>
      <span aria-hidden="true" className="duelio-discord-arrow">↗</span>
    </a>
  );
}
