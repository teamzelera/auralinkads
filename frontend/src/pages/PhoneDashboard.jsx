import { useState, useEffect } from "react";
import { Send, Clock, LogOut, Smartphone } from "lucide-react";
import logo from "../images/logo.jpeg";
import DeviceSettingsButton from "../components/DeviceSettingsButton";

export default function PhoneDashboard() {
    const [deviceCode, setDeviceCode] = useState("");

    useEffect(() => {
        const code = localStorage.getItem("device_code") || "";
        setDeviceCode(code.toUpperCase());
    }, []);

    const handleDisconnect = () => {
        localStorage.removeItem("device_token");
        localStorage.removeItem("device_code");
        window.location.href = "/device";
    };

    const menuItems = [
        {
            icon: Send,
            label: "Send File",
            desc: "Transfer a video to your TV",
            action: () => window.location.href = `/device/transfer?code=${deviceCode}`,
            color: "from-purple-600 to-cyan-500",
        },
        {
            icon: Clock,
            label: "Transfer History",
            desc: "View past transfers",
            action: () => window.location.href = `/device/transfers?code=${deviceCode}`,
            color: "from-blue-600 to-indigo-500",
        },
    ];

    return (
        <div className="min-h-screen bg-black text-white flex flex-col">
            {/* Header */}
            <div className="pt-12 pb-6 px-6 text-center relative">
                <div className="absolute top-4 right-4">
                    <DeviceSettingsButton />
                </div>
                <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-glow bg-white overflow-hidden">
                    <img src={logo} alt="AuraLink" className="w-full h-full object-contain" />
                </div>
                <h1 className="text-xl font-bold text-white mb-1">AuraLink Remote</h1>
                <p className="text-gray-500 text-sm">Control your device</p>
            </div>

            {/* Connected device */}
            <div className="mx-6 mb-6">
                <div className="bg-gray-900 border border-gray-700 rounded-2xl px-5 py-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                        <Smartphone className="w-5 h-5 text-green-400" />
                    </div>
                    <div className="flex-1">
                        <p className="text-gray-500 text-xs">Connected Device</p>
                        <p className="text-white font-mono font-bold text-lg tracking-wider">{deviceCode || "—"}</p>
                    </div>
                    <div className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
                </div>
            </div>

            {/* Menu */}
            <div className="px-6 space-y-3 flex-1">
                {menuItems.map(({ icon: Icon, label, desc, action, color }) => (
                    <button
                        key={label}
                        onClick={action}
                        className="w-full bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-center gap-4 hover:border-gray-600 transition-all duration-200 text-left group"
                    >
                        <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-lg`}>
                            <Icon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <p className="text-white font-semibold text-sm group-hover:text-purple-300 transition-colors">{label}</p>
                            <p className="text-gray-500 text-xs">{desc}</p>
                        </div>
                    </button>
                ))}
            </div>

            {/* Disconnect */}
            <div className="p-6">
                <button
                    onClick={handleDisconnect}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm text-red-400 border border-red-500/30 hover:bg-red-500/10 transition-colors"
                >
                    <LogOut className="w-4 h-4" />
                    Disconnect
                </button>
            </div>
        </div>
    );
}
