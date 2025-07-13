import { mutate } from "./mutate";

test("mutate with simple object", () => {
    const base = { name: "Thomas" };

    const result = mutate(base, (value) => {
        value.name = "Lisa"
    })

    expect(base).not.toBe(result);
    expect(result).toStrictEqual({ name: "Lisa" });
})


test("mutate nested object", () => {
    const base = { project: "ptrs", metadata: { version: 1 } };

    const result = mutate(base, (value) => {
        value.metadata.version = 2;
    })

    expect(base).not.toBe(result);
    expect(base.metadata).not.toBe(result.metadata);
    expect(result).toStrictEqual({ project: "ptrs", metadata: { version: 2 } });
})