import { memo, useEffect } from "react";
import '@testing-library/jest-dom'
import { render, screen, configure } from '@testing-library/react'
import { createPointer, Pointer, ptrs, subscribe, useMemoPointer, usePointer, useStatePointer } from "./index";


configure({ reactStrictMode: true })

test("create a new pointer", () => {
    const pointer = createPointer(0);

    expect(pointer()).toBe(0);

    pointer(1)

    expect(pointer()).toBe(1);
})

test("subscribe to pointer changes", () => {
    const a = createPointer(0);

    let called = 0
    let unsubscribe = subscribe((a) => {
        called++;
        expect(a()).toBe(1);
    }, a)

    a(1);
    expect(called).toBe(1);

    unsubscribe();

    a(2);
    expect(called).toBe(1);

    const b = createPointer(0);

    called = 0;
    unsubscribe = subscribe((p) => {
        called++;
        if (called === 1) {
            expect(p).toBe(a);
        } else {
            expect(p).toBe(b);
        }
    }, a, b)

    a(1);
    expect(called).toBe(1);

    b(1);
    expect(called).toBe(2);

    unsubscribe(a)
    a(2);
    expect(called).toBe(2);
    b(2);
    expect(called).toBe(3);

    unsubscribe(b);
    a(3);
    b(3);
    expect(called).toBe(3);
})

test("child updated triggers parent subscribers", () => {
    const obj = createPointer({ person: { name: "Thomas" } });

    let root = 0;
    subscribe(() => { root++; }, obj);

    let person = 0;
    subscribe(() => { person++; }, obj.person);

    let name = 0;
    subscribe(() => { name++; }, obj.person.name);

    obj.person.name("Lisa");

    expect(root).toBe(1);
    expect(person).toBe(1);
    expect(name).toBe(1);
})

test("set pointer to same value does not trigger subscribers", () => {
    const pointer = createPointer(42);

    let called = 0;
    subscribe(() => { called++; }, pointer);

    pointer(42); // same value
    expect(called).toBe(0);

    pointer(43);
    expect(called).toBe(1);
})

test("unsubscribe from all pointers without argument", () => {
    const a = createPointer(1);
    const b = createPointer(2);

    let called = 0;
    const unsubscribe = subscribe(() => { called++; }, a, b);

    a(2);
    b(3);
    expect(called).toBe(2);

    unsubscribe();
    a(3);
    b(4);
    expect(called).toBe(2);
})

test("access and update pointer property", () => {
    const pointer = createPointer({ name: "Thomas" });
    const personObj = pointer();

    expect(pointer()).toMatchObject({ name: "Thomas" });
    expect(pointer.name()).toBe("Thomas");

    const name = pointer.name;
    name("Lisa")

    expect(name()).toBe("Lisa");
    expect(pointer()).toMatchObject({ name: "Lisa" });
    expect(pointer.name()).toBe("Lisa");

    // change bubbles up to the base pointer -> new object
    expect(pointer()).not.toBe(personObj);
})

test("update nested pointer property", () => {
    const pointer = createPointer({ person: { name: "Thomas" } });
    const name = pointer.person.name

    expect(name()).toBe("Thomas");

    pointer({ person: { name: "Lisa" } });

    expect(pointer.person.name()).toBe("Lisa");
    expect(name()).toBe("Lisa");
})

test("mutate pointer deeply without mutating original object", () => {
    const orig = { foo: { bar: 1 } };
    const pointer = createPointer(orig);

    pointer.foo.bar(2);

    expect(orig.foo.bar).toBe(1);
    expect(pointer.foo.bar()).toBe(2);
})

test("access undefined property on pointer", () => {
    type Item = { name: string, predecessor?: Item }

    const pointer = createPointer<Item>({ name: "Web3", predecessor: undefined });
    const predecessorName = pointer.predecessor.name;

    expect(predecessorName()).toBe(undefined)

    predecessorName("Web2");

    expect(predecessorName()).toBe("Web2");
    expect(pointer.predecessor()).toMatchObject({ name: "Web2" });
    expect(pointer()).toMatchObject({ name: "Web3", predecessor: { name: "Web2" } });
})

test("set pointer property to undefined", () => {
    type Item = { name: string, predecessor?: Item }

    const pointer = createPointer<Item>({ name: "Web3", predecessor: { name: "Web2" } });
    const predecessorName = pointer.predecessor.name;

    expect(predecessorName()).toBe("Web2")

    pointer.predecessor(undefined as any);

    expect(predecessorName()).toBe(undefined);
    expect(pointer.predecessor()).toBe(undefined);
    expect(pointer()).toMatchObject({ name: "Web3" });
})

test("render pointer value in react component", () => {
    const pointer: Pointer<number> = createPointer(0);

    const TestComponent = () => {
        return pointer();
    }

    render(<TestComponent />)
    expect(screen.getByText("0")).toBeInTheDocument();
})

test("create pointer with useStatePointer", () => {

    const TestComponent = (props: { value: number }) => {
        const value = useStatePointer(props.value);
        return <Child value={value} />
    }

    const Child = (props: { value: Pointer<number> }) => {
        return props.value()
    }

    render(<TestComponent value={0} />)
    expect(screen.getByText("0")).toBeInTheDocument();
})

test("do not rerender child when useStatePointer changes", () => {

    const TestComponent = (props: { value: number }) => {
        const value = useStatePointer(props.value);
        return <Child value={value} />
    }

    const Child = (props: { value: Pointer<number> }) => {
        return props.value()
    }

    render(<TestComponent value={0} />)
    expect(screen.getByText("0")).toBeInTheDocument();


    render(<TestComponent value={1} />)
    expect(screen.getByText("0")).toBeInTheDocument();
})

test("create pointer with useMemoPointer", () => {

    const TestComponent = (props: { value: number }) => {
        const value = useMemoPointer(props.value);
        return value()
    }

    const { rerender } = render(<TestComponent value={0} />)
    expect(screen.getByText("0")).toBeInTheDocument();

    rerender(<TestComponent value={1} />)
    expect(screen.getByText("1")).toBeInTheDocument();
})


test("subscribe to pointer in child with usePointer", () => {

    const TestComponent = ((props: { value: number }) => {
        const value = useStatePointer(props.value);
        useEffect(() => { value(props.value) }, [value, props.value]);
        return <Child value={value} />
    })

    const Child = ((props: { value: Pointer<number> }) => {
        usePointer(props.value);
        return props.value()
    })

    const { rerender } = render(<TestComponent value={0} />)
    expect(screen.getByText("0")).toBeInTheDocument();

    rerender(<TestComponent value={1} />)
    expect(screen.getByText("1")).toBeInTheDocument();
})

test("render pointer value in ptrs component", () => {

    const TestComponent = ((props: { value: number }) => {
        const value = useMemoPointer(props.value);
        return <Child value={value} />
    })

    const Child = ptrs((props: { value: Pointer<number> }) => {
        return props.value()
    })

    const { rerender } = render(<TestComponent value={0} />)
    expect(screen.getByText("0")).toBeInTheDocument();

    rerender(<TestComponent value={1} />)
    expect(screen.getByText("1")).toBeInTheDocument();
})

test("rerender ptrs component only on pointer dependency change", () => {

    let parentRenders = 0
    let childRenders = 0

    const TestComponent = ((props: { a: number, b: number }) => {
        const a = useMemoPointer(props.a, false);
        const b = useMemoPointer(props.b, false);
        parentRenders++;
        return <Child a={a} b={b} />
    })

    // use memo to avoid re-rendering just because the parent re-renders
    const Child = memo(ptrs((props: { a: Pointer<number>, b: Pointer<number> }) => {
        childRenders++;
        return props.a() ? (props.b() ? "a,b" : "a") : "nothing";
    }))

    // render without strict to get deterministic results
    const { rerender } = render(<TestComponent a={0} b={0} />, { reactStrictMode: false })
    expect(screen.getByText("nothing")).toBeInTheDocument();
    expect(parentRenders).toBe(1); // two because of strict mode
    expect(childRenders).toBe(1);

    rerender(<TestComponent a={0} b={1} />)
    expect(screen.getByText("nothing")).toBeInTheDocument();
    expect(parentRenders).toBe(2);
    expect(childRenders).toBe(1);

    rerender(<TestComponent a={1} b={1} />)
    expect(screen.getByText("a,b")).toBeInTheDocument();
    expect(parentRenders).toBe(3);
    expect(childRenders).toBe(2);

    rerender(<TestComponent a={1} b={0} />)
    expect(screen.getByText("a")).toBeInTheDocument();
    expect(parentRenders).toBe(4);
    expect(childRenders).toBe(3);
})