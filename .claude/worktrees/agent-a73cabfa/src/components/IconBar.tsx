import type { User } from '@supabase/supabase-js'

interface Props {
  onSettings: () => void
  onSearch: () => void
  onHome: () => void
  user: User | null
  sidebarExpanded: boolean
  onToggleSidebar: () => void
  hasActiveSession: boolean
}

function NavIcon({ icon, active, onClick, title }: { icon: React.ReactNode, active?: boolean, onClick: () => void, title: string }) {
  return (
    <button
      className={`iconbar-btn ${active ? 'active' : ''}`}
      onClick={onClick}
      title={title}
    >
      {icon}
    </button>
  )
}

export function IconBar({ onSettings, onSearch, onHome, user, sidebarExpanded, onToggleSidebar, hasActiveSession }: Props) {
  return (
    <div className="iconbar">
      {/* Logo */}
      <button className="iconbar-logo" onClick={onHome} title="Home">
        <span className="iconbar-logo-letter">M</span>
      </button>

      {/* Nav */}
      <NavIcon
        icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>}
        active={hasActiveSession && !sidebarExpanded}
        onClick={() => { if (sidebarExpanded) onToggleSidebar() }}
        title="Chat"
      />
      <NavIcon
        icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}
        active={sidebarExpanded}
        onClick={onToggleSidebar}
        title="Documents"
      />
      <NavIcon
        icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>}
        active={false}
        onClick={onSearch}
        title="Search"
      />

      <div className="iconbar-spacer" />

      {/* Settings */}
      <NavIcon
        icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>}
        active={false}
        onClick={onSettings}
        title="Settings"
      />

      {/* User avatar */}
      {user?.user_metadata?.avatar_url ? (
        <img src={user.user_metadata.avatar_url} alt="" className="iconbar-avatar" onClick={onSettings} />
      ) : (
        <div className="iconbar-avatar iconbar-avatar-gradient" onClick={onSettings} />
      )}
    </div>
  )
}
