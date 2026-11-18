import { useMemo, useState } from "react";
import type { FilterUi, NTableProps, SimpleFilterValues } from "./types";
import { ViewBar } from "./ViewBar";
import { TableToolbar } from "./TableToolbar";
import { Table } from "./Table";
import { resolveSimpleFields, simpleFilterRules } from "./simpleFilter";

export function NTable(props: NTableProps) {
  const [search, setSearch] = useState("");
  const [searchResetKey, setSearchResetKey] = useState(0);
  // 筛选方式和简单筛选的值：宿主传了就受控，否则在这里维护，工具栏和表格共用一份
  const [internalUi, setInternalUi] = useState<FilterUi>("simple");
  const [internalValues, setInternalValues] = useState<SimpleFilterValues>({});
  const filterUi = props.filterUi ?? internalUi;
  const simpleValues = props.simpleFilterValues ?? internalValues;
  const changeUi = (ui: FilterUi) => { if (props.filterUi === undefined) setInternalUi(ui); props.onFilterUiChange?.(ui); };
  const changeSimpleValues = (values: SimpleFilterValues) => { if (props.simpleFilterValues === undefined) setInternalValues(values); props.onSimpleFilterValuesChange?.(values); };
  const fieldById = useMemo(() => new Map(props.fields.map((field) => [field.id, field])), [props.fields]);
  const simpleEnabled = resolveSimpleFields(props.simpleFilterFields, fieldById).length > 0;
  // 简单筛选只在简单模式下生效；切到高级时值保留但不参与筛选
  const extraFilters = useMemo(() => simpleEnabled && filterUi === "simple" ? simpleFilterRules(simpleValues, fieldById) : [], [simpleEnabled, filterUi, simpleValues, fieldById]);
  const clearQuery = () => {
    setSearch("");
    setSearchResetKey(value => value + 1);
    changeSimpleValues({});
    props.onUpdateView(props.activeView.id, { filters: [] });
  };
  return <section className="ntable">
    <ViewBar {...props} />
    <TableToolbar {...props} filterUi={filterUi} onFilterUiChange={changeUi} simpleFilterValues={simpleValues} onSimpleFilterValuesChange={changeSimpleValues} rows={props.rows} getSubRows={props.getSubRows} search={search} searchResetKey={searchResetKey} onSearchChange={setSearch} />
    <Table {...props} search={search} extraFilters={extraFilters} onClearQuery={clearQuery} />
  </section>;
}
