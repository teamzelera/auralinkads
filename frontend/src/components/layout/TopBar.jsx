import { Bell, Wifi, Menu } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";

export default function TopBar({ title, onMenuClick }) {
    return (
        <header className="h-16 bg-primary-card border-b border-primary-border px-4 sm:px-6 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
                <button 
                    onClick={onMenuClick}
                    className="md:hidden w-9 h-9 rounded-xl bg-primary-bg border border-primary-border flex items-center justify-center text-text-secondary hover:text-white transition-colors"
                >
                    <Menu className="w-5 h-5" />
                </button>
                <h1 className="text-lg font-semibold text-text-primary truncate">{title}</h1>
            </div>
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-status-online text-xs bg-status-online/10 border border-status-online/20 px-3 py-1.5 rounded-full">
                    <Wifi className="w-3.5 h-3.5" />
                    <span className="font-medium">Live</span>
                </div>
                <button className="w-9 h-9 rounded-xl bg-primary-bg border border-primary-border flex items-center justify-center hover:border-accent-purple transition-colors duration-200">
                    <Bell className="w-4 h-4 text-text-secondary" />
                </button>
            </div>
        </header>
    );
}
