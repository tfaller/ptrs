/**
 * Safely mutate an object with an action function.
 * It is possible that more objects are created than necessary.
 * All accessed descendants of the object are cloned. If something referenced
 * a descendant, it from now on references a potential outdated version.
 * Newly created objects are frozen, but not assigned objects.
 * @param value Value to mutate
 * @param action Mutation action
 * @returns New mutated value
 */
export const mutate = <T extends object>(value: T, action: (value: T) => void) => {
    const mutatedObjects = new Map<object, object>();
    const mappedProps = new Map<object, Set<() => any>>();

    // If currently the action is running
    let inAction = false

    // Every element that is touched by the action gets recreated.
    // This is a bit wasteful, because many/most elements will not be updated, just read.
    // However, this makes it much simpler.
    // Also, we don't use proxies, because if a value would be assigned to something
    // outside of the action, it could never get rid of the proxy.

    const shallowCloneObject = <T extends object>(value: T): T => {

        if (mutatedObjects.has(value)) {
            return mutatedObjects.get(value)! as T;
        }

        const props = Object.getOwnPropertyDescriptors(value)
        const getters = new Set<() => any>();

        // We can't simply use Object.entries, because that skips symbols.

        proxyGetter(props, Object.getOwnPropertyNames(props), getters);
        proxyGetter(props, Object.getOwnPropertySymbols(props), getters);

        const isArray = Array.isArray(value);

        if (isArray) {
            // length is not configurable
            delete props.length;
        }

        const obj = isArray
            ? Object.defineProperties([], props) as T
            : Object.create(Object.getPrototypeOf(value), props);

        mutatedObjects.set(value, obj);
        mappedProps.set(obj, getters);

        if (isArray) {
            // Make sure for sparse arrays that the length is correct.
            obj.length = value.length;
        }

        return obj;
    }

    const proxyGetter = (
        descriptors: Record<PropertyKey, PropertyDescriptor>,
        props: PropertyKey[], getters: Set<() => any>) => {

        // Replace all value props with a getter.
        // This getter will clone objects on access, so that they can be mutated.

        for (const p of props) {
            const prop = descriptors[p];

            if (prop.writable !== undefined) {
                // Whether the action changed the value.
                let changed = false

                const getter = () => {
                    const value = prop.value

                    if (inAction && !changed && typeof value === "object") {
                        changed = true
                        return prop.value = shallowCloneObject(value)
                    }

                    return value;
                }

                descriptors[p] = {
                    configurable: true,
                    enumerable: prop.enumerable,
                    get: getter,
                    set: (v: any) => (changed = true, prop.value = v),
                }

                getters.add(getter);
            }
        }
    }

    const cloned = shallowCloneObject(value);

    inAction = true;
    action(cloned);
    inAction = false;

    // Finalize all objects, mutation is done
    for (const obj of mutatedObjects.values()) {
        finalizeMutation(obj, mappedProps.get(obj)!);
    }

    return cloned;
}

const finalizeMutation = (value: object, getters: Set<() => any>) => {
    const props = Object.getOwnPropertyDescriptors(value)

    finalizeMutationProp(value, props, Object.getOwnPropertyNames(props), getters);
    finalizeMutationProp(value, props, Object.getOwnPropertySymbols(props), getters);

    // Freeze the object, so it can't be mutated anymore.
    Object.freeze(value);
}

const finalizeMutationProp = (
    obj: object, descriptors: Record<PropertyKey, PropertyDescriptor>,
    props: PropertyKey[], getters: Set<() => any>) => {

    for (const p of props) {
        const prop = descriptors[p];

        if (prop.get && getters.has(prop.get)) {
            // change to an regular value prop
            Object.defineProperty(obj, p, { value: prop.get() });
        }
    }
}