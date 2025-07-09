import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * A pointer references to an actual value. A pointer is stable and won't change
 * when the value changes. The value of a pointer can be accessed and changed.
 * 
 * ```
 * pointer() // gets the value
 * pointer(newValue) // sets a new value
 * ```
 */
export type Pointer<T> =
    (T extends object ? (PointerFunc<T> & ObjectPointer<Required<T>>) : PointerFunc<T>)
    & NeverFunctionProp<T>

/**
* Valid pointer signatures
*/
type PointerFunc<T> = {
    (): T;
    (value: T): void;
}

type ObjectPointer<T extends object> = {
    [P in keyof T]: Pointer<T[P]>;
}

/**
 * We can't hide function properties, otherwise the pointer would not be callable.
 * But we can make them never, so that they are not "usable".
 */
type NeverFunctionProp<T> = {
    [P in Exclude<keyof Function, keyof T>]: never;
}
/**
 * Whether the pointer update should bubble up
 */
let bubbleUp = true;

/**
 * Creates a pointer for a value. The given value is the initial value of the pointer.
 * The setter is called when the pointer is set to a new value, so an external state, like
 * a variable or useState, can be updated. However, that external state should not update its value anymore.
 * Updates must be done through the pointer itself, otherwise the pointer won't see the changes.
 * 
 * @param value The initial value of the pointer.
 * @param setter A function that will be called when the pointer is set.
 */
export const createPointer = <T>(value: T, setter?: (newData: T) => void): Pointer<T> => {
    // when we are an object, we store here our proxied properties
    const proxyProps: Record<PropertyKey, WeakRef<Pointer<any>>> = {}

    const self = new Proxy(() => value, {

        apply(target, thisArg, argArray) {

            // called when the pointer value should be changed or read

            if (argArray.length === 0) {

                if (watchUsedPointers)
                    usedPointers.add(self);

                return value;

            } else if (argArray.length === 1) {
                const newValue = argArray[0];

                if (newValue === value)
                    return;

                value = newValue;
                bubbleUp && setter?.(value)

                subscribers.get(self)?.forEach(sub => {
                    sub.deref()?.((old: number) => old + 1)
                })

                // we have to disable bubble up, while updating children
                const prevBubbleUp = bubbleUp
                bubbleUp = false;

                for (const prop in proxyProps) {
                    proxyProps[prop].deref()?.(value?.[prop as keyof typeof value]);
                }

                bubbleUp = prevBubbleUp;

            } else {
                throw new Error('Pointer can only be called with 0 or 1 arguments.');
            }
        },

        get(target, prop) {

            let p = proxyProps[prop]?.deref()

            if (!p) {
                const propValue = value?.[prop as keyof typeof value]

                proxyProps[prop] = new WeakRef(p = createPointer(propValue, (newValue) => {
                    value = { ...value, [prop]: newValue }
                    setter?.(value)
                }))
            }

            return p
        }
    })

    return self as Pointer<T>;
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

    const [, subscriber] = useState(0)
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


/**
 * Creates a pointer to a new state.
 * @param initialValue The initial value of the pointer/state.
 * @param usePointerHook If true, the pointer will be registered with the usePointer hook.
 */
export const useStatePointer = <T>(initialValue: T, usePointerHook = true): Pointer<T> => {
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
export const useMemoPointer = <T>(value: T, usePointerHook = true): Pointer<T> => {
    const ptr = useStatePointer(value, usePointerHook);
    useEffect(() => { ptr(value) }, [ptr, value]);
    return ptr;
}


const usedPointers: Set<Pointer<any>> = new Set();
let watchUsedPointers = false;

/**
 * ptrs watches for pointer usage in the component.
 * Conditional usage is no problem, unlike with usePointer (can't be used in ifs, like any other hook).
 * The component will re-render if the component used a pointer's value during rendering, that now changed.
 * It only watches for itself, not for pointer usage in its children.
 * 
 * Conditional rendering works like:
 * ```
 * if (pointerA()) {
 *   console.log(pointerB()); // change of pointerB will only re-render if pointerA was truthy
 * }
 * ```
 * @param component The component to watch
 * @returns A wrapped component that behaves like the original component, but watches for pointer usage.
 */
export const ptrs = <P extends {}>(component: React.FunctionComponent<P>) => ((props: P) => {

    if (watchUsedPointers) {
        throw new Error("There should never run two ptrs components at the same time. If they do, it breaks general assumptions about the ptrs component.");
    }
    watchUsedPointers = true;

    try {

        // render the actual component
        return component(props);

    } finally {
        // the usePointer hook can use usedPointers itself, if we are in a ptrs component
        // so we have to disable it, so that usePointer will create a subscriber
        watchUsedPointers = false;

        // register all used pointers
        usePointer(...usedPointers);

        usedPointers.clear();
    }

})

/**
 * Subscribes to pointer changes.
 * @param subscriber The subscriber function that will be called when the pointer changes.
 * @param pointer One or more pointers to subscribe to.
 * @returns Function that can be used to unsubscribe from pointers. No argument -> all pointers will be unsubscribed.
 */
export const subscribe = <T>(subscriber: (p: Pointer<T>) => void, ...pointer: Pointer<T>[]) => {
    const wrappers = new Map<Pointer<T>, () => void>()

    for (const p of pointer) {

        const subWrapper = () => {
            subscriber(p)
        }

        wrappers.set(p, subWrapper);
        subscribersAdd(p, subWrapper)
    }

    return (...pointers: Pointer<T>[]) => {
        const unSub = pointers.length === 0 ? wrappers.keys() : pointers

        for (const p of unSub) {
            const wrapper = wrappers.get(p);

            if (wrapper) {
                subscribersRemove(p, wrapper);
                wrappers.delete(p);
            }
        }
    }
}

/**
 * A global state where we store all currently subscribed pointers.
 * There should usually be no memory leaks, because we use WeakMap and WeakRef.
 */
const subscribers = new WeakMap<Pointer<any>, WeakRef<Subscriber>[]>()

type Subscriber = React.Dispatch<React.SetStateAction<number>>;

const subscribersAdd = (pointer: Pointer<any>, subscriber: Subscriber) => {

    const subs = subscribers.get(pointer)?.filter(s => {
        const d = s.deref();
        return d && d !== subscriber;
    }) ?? [];

    subs.push(new WeakRef(subscriber));
    subscribers.set(pointer, subs);
}

const subscribersRemove = (pointer: Pointer<any>, subscriber: Subscriber) => {

    const subs = subscribers.get(pointer);

    if (!subs) return;

    const newSubs = subs.filter(s => {
        const d = s.deref();
        return d && d !== subscriber;
    })

    if (newSubs.length === 0) {
        subscribers.delete(pointer);
    } else {
        subscribers.set(pointer, newSubs);
    }
}