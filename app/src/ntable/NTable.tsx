import { useState } from "react";
import type { NTableProps } from "./types";
import { ViewBar } from "./ViewBar";
import { TableToolbar } from "./TableToolbar";
import { Table } from "./Table";

export function NTable(props: NTableProps) {
  const [search, setSearch] = useState("");
  return <section className="ntable">
    <ViewBar {...props} />
    <TableToolbar {...props} search={search} onSearchChange={setSearch} />
    <Table {...props} search={search} />
  </section>;
}
