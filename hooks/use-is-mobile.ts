import { useState, useEffect } from "react";

export function useIsMobile(breakpoint = 768) {
    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth <= breakpoint);
        check();
        const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
        mq.addEventListener("change", check);
        return () => mq.removeEventListener("change", check);
    }, [breakpoint]);
    return isMobile;
}
