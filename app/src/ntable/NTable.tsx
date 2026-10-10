import { useState } from "react";
import type { NTableProps } from "./types";
import { ViewBar } from "./ViewBar";
import { TableToolbar } from "./TableToolbar";
import { Table } from "./Table";

export function NTable(props: NTableProps) {
  const [search, setSearch] = useState("");
  const [searchResetKey, setSearchResetKey] = useState(0);
  const clearQuery = () => {
    setSearch("");
    setSearchResetKey(value => value + 1);
    props.onUpdateView(props.activeView.id, { filters: [] });
  };
  return <section className="ntable">
    <ViewBar {...props} />
    <TableToolbar {...props} search={search} searchResetKey={searchResetKey} onSearchChange={setSearch} />
    <Table {...props} search={search} onClearQuery={clearQuery} />
  </section>;
}
