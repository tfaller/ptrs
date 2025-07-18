/**
 * Safely mutate an object with an action function.
 * It is possible that more objects are created than necessary.
 * Newly created objects are frozen, but not assigned objects.
 * @param value Value to mutate
 * @param action Mutation action
 * @returns New mutated value
 */
export const mutate = <T extends object>(value: T, action: (value: T) => void) => {
    const proxies = new Map<object, ReturnType<typeof Proxy.revocable>>();
    const proxyTarget = new Map<object, object>();

    const proxyClone = (value: object) => {

        const newValue = Array.isArray(value) ? [...value] : shallowCloneObject(value);
        const prx = Proxy.revocable(newValue, handler);

        // Cache for both values
        proxies.set(value, prx);
        proxies.set(newValue, prx);

        // For assignments we later need the actual value
        proxyTarget.set(prx.proxy, newValue);

        return [prx.proxy, newValue];
    }

    // Every element that is touched by the action gets recreated.
    // This is a bit wasteful, because many/most elements will not be updated, just read.
    // However, this makes it much simpler.

    const handler: ProxyHandler<any> = {

        get(target, prop) {

            const value = target[prop as keyof typeof target];

            if (typeof value !== "object") {
                return value;
            }

            if (proxies.has(value)) {
                return proxies.get(value)!.proxy;
            }

            const [proxy, newValue] = proxyClone(value);

            // Use new value from now on
            target[prop] = newValue;

            return proxy;
        },

        set(target, prop, value) {

            if (proxies.has(value)) {
                // Make sure we use latest version of the value
                value = proxies.get(value)!.proxy;
            }

            if (proxyTarget.has(value)) {
                // The actual value, not the proxy
                value = proxyTarget.get(value)!;
            }

            return Reflect.set(target, prop, value);
        }
    }

    const [proxy, newValue] = proxyClone(value);

    action(proxy);

    // Mutate helper should not be used outside of this function
    for (const proxy of proxies.values()) {
        proxy.revoke();
    }

    // Freeze all objects, mutation is done
    for (const obj of proxyTarget.values()) {
        Object.freeze(obj);
    }

    return newValue;
}

const shallowCloneObject = <T extends object>(value: T): T =>
    Object.defineProperties({} as T, Object.fromEntries(
        Object.entries(Object.getOwnPropertyDescriptors(value)).map(entry => {
            // We want to mutate, so we have to make them writable.
            // A prop is probably not writable because the original object is frozen.
            if (entry[1].writable === false) {
                entry[1].writable = true
            }
            return entry
        })
    ));