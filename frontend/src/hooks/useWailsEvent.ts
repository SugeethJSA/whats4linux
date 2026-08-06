import { useEffect } from "react"
import { EventsOn } from "../../wailsjs/runtime/runtime"

export function useWailsEvent<T>(type: string, handler: (data: T) => void, deps: unknown[] = []) {
  useEffect(() => {
    const unsub = EventsOn(type, handler as never)
    return () => unsub()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, ...deps])
}
