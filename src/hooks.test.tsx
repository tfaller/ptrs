import { memo } from "react";
import { act, render } from "@testing-library/react"
import { createPointer, Pointer } from "./pointer"
import { usePointer } from "./hooks";

test("unsubscribed at usePointer unmount", () => {
    let i = 0
    const ptrA = createPointer(i);
    const ptrB = createPointer(i);

    const TestComponent = (props: { mounted: boolean, ptr: Pointer<number> }) => {
        return props.mounted ? <Child ptr={props.ptr} /> : null;
    }

    let cr = 0
    const Child = memo((props: { ptr: Pointer<number> }) => {
        cr++
        usePointer(props.ptr);
        return 1
    })

    const { rerender } = render(<TestComponent mounted ptr={ptrA} />);
    expect(cr).toBe(1);

    act(() => ptrA(++i));
    expect(cr).toBe(2);

    rerender(<TestComponent mounted={false} ptr={ptrA} />);
    expect(cr).toBe(2);

    // child is unmounted, so ptrA should not rerender
    act(() => ptrA(++i));
    expect(cr).toBe(2);

    rerender(<TestComponent mounted ptr={ptrB} />);
    expect(cr).toBe(3);

    // ptrA is not allowed to rerender, was the old child
    act(() => ptrA(++i));
    expect(cr).toBe(3);

    // ptrB should rerender, as it is the current child
    act(() => ptrB(++i));
    expect(cr).toBe(4);
})


test("unsubscribed at usePointer key change", () => {
    let i = 0
    const ptr = createPointer(i);

    const TestComponent = (props: { ck: string }) => {
        return <Child key={props.ck} />;
    }

    let cr = 0
    const Child = memo(() => {

        if (cr++ === 0)
            usePointer(ptr);

        return 1
    })

    const { rerender } = render(<TestComponent ck="a" />);
    expect(cr).toBe(1);

    act(() => ptr(++i));
    expect(cr).toBe(2);

    // still rerenders on change, 
    // even though we called usePointer only in the first render
    act(() => ptr(++i));
    expect(cr).toBe(3);

    // rerender on key change
    rerender(<TestComponent ck="b" />);
    expect(cr).toBe(4);

    // Now it will not rerender on ptr change, as it is a new component
    act(() => ptr(++i));
    expect(cr).toBe(4);
})