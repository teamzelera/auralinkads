import { useState, useEffect } from "react";
import { ArrowLeft, RotateCw } from "lucide-react";

export default function DisplayRotation() {
    const [rotationAngle, setRotationAngle] = useState(0);

    // Load saved rotation on mount
    useEffect(() => {
        const savedAngle = localStorage.getItem("device_rotation_angle");
        if (savedAngle !== null) {
            setRotationAngle(Number(savedAngle));
        }
    }, []);

    // Save rotation and update state
    const handleSetRotation = (angle) => {
        setRotationAngle(angle);
        localStorage.setItem("device_rotation_angle", angle);
    };

    const handleCustomChange = (e) => {
        const value = parseInt(e.target.value, 10);
        const newAngle = isNaN(value) ? 0 : value;
        handleSetRotation(newAngle);
    };

    return (
        <div className="min-h-screen bg-black text-white p-6 md:p-10 flex flex-col">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <button
                    onClick={() => window.location.href = "/device"}
                    className="p-3 bg-gray-900 border border-gray-800 rounded-xl hover:bg-gray-800 transition-colors"
                >
                    <ArrowLeft className="w-6 h-6 text-white" />
                </button>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                    Display Rotation
                </h1>
            </div>

            <div className="flex-1 max-w-2xl mx-auto w-full space-y-8">
                {/* Info Card */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                    <p className="text-gray-400 text-sm leading-relaxed">
                        Adjust the display orientation for this device. This rotation will apply to the entire video playback area, ensuring content displays correctly regardless of how your screen is mounted.
                    </p>
                </div>

                {/* Quick Presets */}
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold text-white">Rotate Screen</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[0, 90, 180, 270].map((angle) => (
                            <button
                                key={angle}
                                onClick={() => handleSetRotation(angle)}
                                className={`
                                    relative flex flex-col items-center justify-center p-6 rounded-2xl border transition-all duration-200
                                    ${rotationAngle === angle 
                                        ? "bg-purple-500/10 border-purple-500 text-purple-400" 
                                        : "bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-600 hover:text-white"}
                                `}
                            >
                                <RotateCw className={`w-8 h-8 mb-3 transition-transform duration-500`} style={{ transform: `rotate(${angle}deg)` }} />
                                <span className="font-mono text-lg font-bold">{angle}°</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Advanced Mode */}
                <div className="space-y-4 pt-6 border-t border-gray-800">
                    <h2 className="text-lg font-semibold text-white">Advanced Mode</h2>
                    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                        <label className="block text-sm font-medium text-gray-400 mb-3">
                            Custom Rotation Angle (Degrees)
                        </label>
                        <div className="flex items-center gap-4">
                            <span className="text-gray-500">Rotate:</span>
                            <div className="relative flex-1 max-w-[200px]">
                                <input
                                    type="number"
                                    value={rotationAngle}
                                    onChange={handleCustomChange}
                                    className="w-full bg-black border border-gray-700 rounded-xl px-4 py-3 text-white font-mono focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
                                    placeholder="e.g. 45"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-mono">
                                    deg
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
                
            </div>
            
            {/* Live Preview Note */}
            <div className="text-center pt-8 opacity-60">
                <p className="text-xs text-gray-500">Changes are saved automatically and applied to the player immediately.</p>
            </div>
        </div>
    );
}
