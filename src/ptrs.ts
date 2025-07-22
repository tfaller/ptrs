import { usePointer } from "./hooks";
import { Pointer } from "./pointer";

export const usedPointers: Set<Pointer<any>> = new Set();
export let watchUsedPointers = false;

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
export const ptrs = <P extends {}>(component: React.FunctionComponent<P>) => ((props: P): ReturnType<typeof component> => {

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