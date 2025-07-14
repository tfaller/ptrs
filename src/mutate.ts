/**
 * Safely mutate an object with an action function.
 * It is possible that more objects are created than necessary.
 * All input and output values will be frozen.
 * @param value Value to mutate
 * @param action Mutation action
 * @returns New mutated value
 */
export const mutate = <T extends object>(value: T, action: (value: T) => void) => {
    const proxies = new Map<object, ReturnType<typeof Proxy.revocable>>();
    const proxyTarget = new Map<object, object>();

    const prepareObject = (value: object) => {
        // Freeze so that no accidental mutation happens
        Object.freeze(value);

        const newValue = Array.isArray(value) ? [...value] : { ...value };
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

            if (!(value instanceof Object)) {
                return value;
            }

            if (proxies.has(value)) {
                return proxies.get(value)!.proxy;
            }

            const [proxy, newValue] = prepareObject(value);

            // Use new value from now on
            target[prop] = newValue;

            return proxy;
        },

        set(target, prop, value) {

            if (proxyTarget.has(value)) {
                // The actual value, not the proxy
                value = proxyTarget.get(value)!;
            }

            return Reflect.set(target, prop, value);
        }
    }

    const [proxy, newValue] = prepareObject(value);

    action(proxy);

    // Mutate helper should not be used outside of this function
    for (const proxy of proxies.values()) {
        proxy.revoke();
    }

    // Freeze all objects, mutation is done
    for (const obj of proxies.keys()) {
        Object.freeze(obj);
    }

    return newValue;
}