"use client";

import { UserButton } from "@clerk/nextjs";

export default function UserMenu({ name }: { name?: string | null }) {
  return (
    <div className="flex items-center gap-3">
      <UserButton
        appearance={{
          elements: { avatarBox: "w-8 h-8" },
        }}
      />
      {name && (
        <span className="text-xs leading-tight truncate max-w-[120px]" style={{ color: "rgba(255,255,255,0.6)" }}>
          {name}
        </span>
      )}
    </div>
  );
}
