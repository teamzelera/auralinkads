import { useState, useEffect } from "react";
import { ArrowLeft, CheckCircle, XCircle, Clock, Send } from "lucide-react";
import logo from "../images/logo.jpeg";
import DeviceSettingsButton from "../components/DeviceSettingsButton";

const PLAYER_API = import.meta.env.VITE_API_BASE || "http://localhost:8000/api";

export default function TransferHistory() {
    const [transfers, setTransfers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deviceCode, setDeviceCode] = useState("");

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code") || localStorage.getItem("device_code") || "";
        setDeviceCode(code.toUpperCase());

        if (code) {
            fetch(`${PLAYER_API}/device/transfers/?device_code=${code.toUpperCase()}`)
                .then((r) => r.json())
                .then((data) => { setTransfers(Array.isArray(data) ? data : []); })
                .catch(() => {})
                .finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, []);

    const formatSize = (bytes) =>
        bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    const formatDate = (ts) =>
        new Date(ts).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

    const statusIcon = (s) => {
        if (s === "received") return <CheckCircle className="w-4 h-4 text-green-400" />;
        if (s === "failed") return <XCircle className="w-4 h-4 text-red-400" />;
        return <Send className="w-4 h-4 text-blue-400" />;
    };

    const statusColor = (s) => {
        if (s === "received") return "text-green-400";
        if (s === "failed") return "text-red-400";
        return "text-blue-400";
    };

    return (
        <div className="min-h-screen bg-black text-white flex flex-col">
            {/* Header */}
            <div className="flex items-center gap-4 px-5 py-4 border-b border-gray-800 bg-gray-950">
                <button
                    onClick={() => {
                        // Go back to phone dashboard or device settings
                        if (window.innerWidth < 768) window.location.href = "/device/phone";
                        else window.location.href = "/device";
                    }}
                    className="w-9 h-9 rounded-xl bg-gray-800 hover:bg-gray-700 flex items-center justify-center transition-colors"
                >
                    <ArrowLeft className="w-5 h-5 text-gray-300" />
                </button>
                <div className="w-8 h-8 rounded-xl overflow-hidden bg-white">
                    <img src={logo} alt="AuraLink" className="w-full h-full object-contain" />
                </div>
                <div>
                    <h1 className="text-white font-semibold text-base leading-tight">Transfer History</h1>
                    <p className="text-gray-500 text-xs">{deviceCode}</p>
                </div>
                <DeviceSettingsButton />
            </div>

            <div className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-6 h-6 border-2 border-gray-600 border-t-purple-500 rounded-full animate-spin" />
                    </div>
                ) : transfers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-gray-900 flex items-center justify-center mb-4">
                            <Clock className="w-8 h-8 text-gray-600" />
                        </div>
                        <p className="text-gray-500 text-sm">No transfers yet</p>
                        <p className="text-gray-700 text-xs mt-1">Files sent to this device will appear here</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-800/50">
                        {transfers.map((t) => (
                            <div key={t.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-900/50 transition-colors">
                                <div className="w-9 h-9 rounded-xl bg-gray-800 flex items-center justify-center flex-shrink-0">
                                    {statusIcon(t.status)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-white text-sm font-medium truncate">{t.file_name}</p>
                                    <p className="text-gray-600 text-xs">{formatSize(t.file_size || 0)} · {formatDate(t.created_at)}</p>
                                </div>
                                <span className={`text-xs font-medium capitalize ${statusColor(t.status)}`}>{t.status}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
