"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const menus = [
  { name: "Dashboard", href: "/dashboard", icon: "🏠" },
  { name: "Image Studio", href: "/image", icon: "🖼️" },
  { name: "Script Writer", href: "/script", icon: "📝" },
  { name: "Video Studio", href: "/video", icon: "🎬" },
  { name: "Voice Studio", href: "/voice", icon: "🎤" },
  { name: "Automation", href: "/automation", icon: "🤖" },
  { name: "Analytics", href: "/analytics", icon: "📊" },
  { name: "Profile", href: "/profile", icon: "👤" },
  { name: "Pricing", href: "/pricing", icon: "💎" },
  { name: "Settings", href: "/settings", icon: "⚙️" },
  { name: "Docs", href: "/docs", icon: "📚" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-72 h-screen bg-slate-900 text-white fixed left-0 top-0 overflow-y-auto">

      <div className="text-center py-8 border-b border-slate-700">

        <h1 className="text-2xl font-bold">
          AI Content Studio
        </h1>

        <p className="text-slate-400 text-sm mt-2">
          One Click AI Platform
        </p>

      </div>

      <nav className="p-4 space-y-2">

        {menus.map((menu) => (
          <Link
            key={menu.href}
            href={menu.href}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${
              pathname === menu.href
                ? "bg-blue-600"
                : "hover:bg-slate-800"
            }`}
          >
            <span className="text-xl">{menu.icon}</span>
            <span>{menu.name}</span>
          </Link>
        ))}

      </nav>

    </aside>
  );
}