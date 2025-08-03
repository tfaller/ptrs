import { useEffect, useMemo, useReducer, useRef } from "react";
import { createPointer, NoPointer, Pointer, PointerValue } from "./pointer";
import { subscribersAdd, subscribersRemove } from "./subscriber";
import { usedPointers, watchUsedPointers } from "./ptrs";

/**
 * Creates a pointer to a new state.
 * @param initialValue The initial value of the pointer/state.
 * @param usePointerHook If true, the pointer will be registered with the usePointer hook.
 */
export const useStatePointer = <T>(initialValue: PointerValue<T>, usePointerHook = true) => {
    const ptr = useMemo(() => createPointer(initialValue), []);

    if (usePointerHook) {
        // most of the time the user wants to re-render the state owner when the pointer changes
        // so we register by default

        if (watchUsedPointers) {
            // far more efficient than using usePointer
            usedPointers.add(ptr);
        } else {
            usePointer(ptr);
        }
    }

    return ptr
}

/**
 * Basically like useStatePointer, but the pointer value updates if the given value changes.
 * @param value The value which the pointer holds.
 * @param usePointerHook If true, the pointer will be registered with the usePointer hook.
 */
export const useMemoPointer = <T>(value: PointerValue<T>, usePointerHook = true) => {
    const ptr = useStatePointer(value, usePointerHook);
    useEffect(() => { ptr(value as NoPointer<typeof value>) }, [ptr, value]);
    return ptr;
}

/**
 * Pointers are stable, which means that e.g. a component with a pointer prop will not re-render
 * when the pointer value changes. If re-rendering is needed, this hook can be used.
 * A re-render will happen when the value of one pointer changes.
 * The list of pointers can be different on each call/render (the order or count can change).
 * As an alternative, the `ptrs` component can be used, which will automatically
 * re-render when any pointer used in the component changes.
 * @param pointers A list of pointers that should cause a re-render when their value changes.
 */
export const usePointer = (...pointers: Pointer<any>[]) => {

    type VersionPointerMap = Map<Pointer<any>, { version: number }> & { version: number };

    if (watchUsedPointers) {
        // we don't need to manage a own subscriber, just use the current running ptrs component 
        for (const p of pointers) {
            usedPointers.add(p);
        }
        return;
    }

    const [, subscriber] = useReducer(usePointerReducer, 0)
    const pointerMap = useRef<VersionPointerMap>(null);

    const pm = pointerMap.current ?? (pointerMap.current = new Map() as VersionPointerMap);
    const newVersion = pm.version = (pm.version ?? 0) + 1;

    for (const p of pointers) {
        const entry = pm.get(p)

        if (entry) {
            entry.version = newVersion
        } else {
            pm.set(p, { version: newVersion })
            subscribersAdd(p, subscriber)
        }
    }

    // remove pointers with old version => they were not 
    // provided in the current pointer list
    for (const entry of pm.entries()) {
        const [p, { version }] = entry;

        if (version !== newVersion) {
            subscribersRemove(p, subscriber);
            pm.delete(p);
        }
    }

    useEffect(() => (() => {
        // component won't be used anymore, clean up subscribers
        const pm = pointerMap.current!;
        for (const p of pm.keys()) {
            subscribersRemove(p, subscriber);
        }
        pm.clear();
    }), [])
}

const usePointerReducer = (state: number) => state + 1