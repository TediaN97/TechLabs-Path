import { useState, useRef, useEffect, type FormEvent } from "react";

const VALID_PIN = "123456";

function LockIcon() {
  return (
    <svg className="h-10 w-10 text-[#319795]" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  );
}

export default function SecurityGateway({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [pin, setPin] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  function handleChange(index: number, value: string) {
    if (!/^\d?$/.test(value)) return;
    const next = [...pin];
    next[index] = value;
    setPin(next);
    setError("");

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const next = [...pin];
    for (let i = 0; i < 6; i++) {
      next[i] = pasted[i] || "";
    }
    setPin(next);
    const focusIdx = Math.min(pasted.length, 5);
    inputRefs.current[focusIdx]?.focus();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const entered = pin.join("");
    if (entered.length < 6) {
      setError("Please enter all 6 digits.");
      return;
    }
    if (entered === VALID_PIN) {
      setAuthenticated(true);
    } else {
      setError("Incorrect PIN. Please try again.");
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setPin(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    }
  }

  if (authenticated) {
    return <>{children}</>;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className={`bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm mx-4 flex flex-col items-center gap-5 ${shake ? "animate-[shake_0.4s_ease-in-out]" : ""}`}
      >
        <LockIcon />
        <div className="text-center">
          <h2 className="text-lg font-bold text-gray-800">Security Gateway</h2>
          <p className="text-xs text-gray-400 mt-1">Enter 6-digit PIN to access the dashboard</p>
        </div>

        <div className="flex gap-2.5" onPaste={handlePaste}>
          {pin.map((digit, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className="w-11 h-13 text-center text-xl font-bold text-gray-800 border-2 border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#319795]/40 focus:border-[#319795] transition-colors"
              style={{ caretColor: "black" }}
            />
          ))}
        </div>

        {error && (
          <p className="text-xs text-red-500 font-medium -mt-2">{error}</p>
        )}

        <button
          type="submit"
          className="w-full py-2.5 text-sm font-semibold text-white bg-[#319795] rounded-lg hover:bg-[#2C7A7B] active:bg-[#285E61] transition-colors cursor-pointer"
        >
          Submit
        </button>
      </form>
    </div>
  );
}
