import { Pointer } from './pointer';

type Subscriber = React.Dispatch<React.SetStateAction<number>>;

/**
 * A global state where we store all currently subscribed pointers.
 * There should usually be no memory leaks, because we use WeakMap and WeakRef.
 */
export const subscribers = new WeakMap<Pointer<any>, WeakRef<Subscriber>[]>()

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

export const subscribersAdd = (pointer: Pointer<any>, subscriber: Subscriber) => {

    const subs = subscribers.get(pointer)?.filter(s => {
        const d = s.deref();
        return d && d !== subscriber;
    }) ?? [];

    subs.push(new WeakRef(subscriber));
    subscribers.set(pointer, subs);
}

export const subscribersRemove = (pointer: Pointer<any>, subscriber: Subscriber) => {

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