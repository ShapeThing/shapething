import { RdfStore } from "rdf-stores";

export default function storeProxy(store: RdfStore) {
    return new Proxy(store, {
        get(target, prop) {
            // console.log(prop);
            return Reflect.get(target, prop);
        },
    });
}
