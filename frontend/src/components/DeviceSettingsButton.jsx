import { Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";

/**
 * Reusable settings icon button for device-side pages.
 * Navigates to /device and auto-opens the settings panel via ?settings=1.
 */
export default function DeviceSettingsButton() {
    const navigate = useNavigate();
    return (
        <button
            onClick={() => navigate("/device?settings=1")}
            className="ml-auto w-9 h-9 rounded-xl bg-gray-800 hover:bg-gray-700 flex items-center justify-center transition-colors flex-shrink-0"
            title="Settings"
        >
            <Settings className="w-4 h-4 text-gray-300" />
        </button>
    );
}
