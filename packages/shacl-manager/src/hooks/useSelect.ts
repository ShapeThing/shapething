import { noRefetch } from "@/helpers/noRefetch";
import { select } from "@/helpers/runQuery";
import { useDataModel } from "@/hooks/useDataModel";
import type { TypedQuery } from "@shapething/typed-sparql";
import { useQuery } from "@tanstack/react-query";

export const useSelect = <TRow extends object>(query: TypedQuery<TRow>) => {
    const { store } = useDataModel();

    const { data } = useQuery({
        queryKey: [query],
        ...noRefetch,
        // react-query treats a resolved `undefined` as an error ("Query data cannot be undefined"),
        // so "nothing to seed" is represented as `null` instead.
        queryFn: async () => {
            console.log(store.getQuads());
            return select(query, store);
        },
    });

    return data;
};
