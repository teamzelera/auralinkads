import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
    LayoutDashboard, Monitor, Film, ListVideo,
    BarChart2, Settings, LogOut, Tv2, Zap, X
} from "lucide-react";
import logo from "../../images/logo.jpeg";

const navItems = [
    { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/devices", icon: Monitor, label: "Devices" },
    { to: "/videos", icon: Film, label: "Videos" },
    { to: "/playlists", icon: ListVideo, label: "Playlists" },
    { to: "/analytics", icon: BarChart2, label: "Analytics" },
    { to: "/settings", icon: Settings, label: "Settings" },
];

export default function Sidebar({ isOpen, onClose }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate("/ladminsirlogin");
    };

    return (
        <aside 
            className={`fixed inset-y-0 left-0 z-50 w-64 bg-primary-card border-r border-primary-border flex flex-col shrink-0 transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${
                isOpen ? "translate-x-0" : "-translate-x-full"
            }`}
        >
            {/* Logo */}
            <div className="p-4 sm:p-6 border-b border-primary-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-glow bg-white overflow-hidden shrink-0">
                        <img src={logo} alt="AuraLink Logo" className="w-full h-full object-contain" />
                    </div>
                    <div>
                        <span className="font-bold text-lg text-gradient">AuraLink</span>
                        <p className="text-text-muted text-xs -mt-0.5">Signage Platform</p>
                    </div>
                </div>
                {/* Mobile Close Button */}
                <button 
                    onClick={onClose}
                    className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-white hover:bg-primary-bg transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Nav */}
            <nav className="flex-1 overflow-y-auto p-4 space-y-1">
                {navItems.map(({ to, icon: Icon, label }) => (
                    <NavLink
                        key={to}
                        to={to}
                        end={to === "/dashboard"}
                        onClick={() => {
                            if (window.innerWidth < 768) onClose();
                        }}
                        className={({ isActive }) =>
                            isActive ? "sidebar-item-active" : "sidebar-item"
                        }
                    >
                        <Icon className="w-5 h-5 shrink-0" />
                        <span>{label}</span>
                    </NavLink>
                ))}
            </nav>

            {/* User */}
            <div className="p-4 border-t border-primary-border space-y-2">
                <div className="flex items-center gap-3 px-3 py-2">
                    <div className="w-8 h-8 rounded-full bg-accent-purple/20 border border-accent-purple/40 flex items-center justify-center">
                        <span className="text-accent-purple text-sm font-bold">
                            {user?.username?.[0]?.toUpperCase() || "A"}
                        </span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">{user?.username}</p>
                        <p className="text-xs text-text-muted truncate">{user?.email}</p>
                    </div>
                </div>
                <button onClick={handleLogout} className="sidebar-item w-full text-status-offline hover:text-status-offline hover:bg-status-offline/10">
                    <LogOut className="w-4 h-4" />
                    <span>Logout</span>
                </button>
            </div>
        </aside>
    );
}
