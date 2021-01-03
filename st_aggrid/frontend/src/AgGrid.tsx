import {
  Streamlit,
  StreamlitComponentBase,
  withStreamlitConnection
} from "streamlit-component-lib";

import React, { ReactNode } from "react"
import { AgGridReact } from 'ag-grid-react';
import { ColumnApi, GridApi } from 'ag-grid-community'

import 'ag-grid-enterprise'
import 'ag-grid-community/dist/styles/ag-grid.css';
import 'ag-grid-community/dist/styles/ag-theme-balham.css';

import { parseISO, compareAsc, isDate } from 'date-fns'
import { format } from 'date-fns-tz'


class AgGrid extends StreamlitComponentBase {
  private frame_dtypes: any
  private gridOptions: any
  private gridData: any
  private api!: GridApi;
  private columnApi!: ColumnApi
  private columnFormaters: any
  private manual_update_requested: boolean

  constructor(props: any) {
    super(props)

    this.frame_dtypes = props.args['frame_dtypes']
    this.gridData = JSON.parse(props.args['gridData'])
    this.gridOptions = props.args['gridOptions']

    this.manual_update_requested = (props.args['update_mode'] === 1)

    this.columnFormaters = {
      columnTypes: {
        'dateColumnFilter': {
          filter: 'agDateColumnFilter',
          filterParams: {
            comparator: (filterValue: any, cellValue: string) => compareAsc(parseISO(cellValue), filterValue)
          }
        },
        'numberColumnFilter': {
          filter: 'agNumberColumnFilter'
        },
        'shortDateTimeFormat': {
          valueFormatter: (params: any) => this.date_formater(params.value, "dd/MM/yyyy HH:mm"),
        },
        'customDateTimeFormat': {
          valueFormatter: (params: any) => this.date_formater(params.value, params.column.colDef.custom_format_string),
        },
        'customNumericFormat': {
          valueFormatter: (params: any) => this.number_formater(params.value, params.column.colDef.precision),
        },

      }
    }
  }

  private set_update_mode() {
    if (this.manual_update_requested) {
      return //If manual update is set, no listeners will be added
    }

    let update_mode = this.props.args['update_mode']

    if ((update_mode & 2) === 2) {
      this.api.addEventListener('cellValueChanged', (e: any) => this.returnGridValue(e))
    }

    if ((update_mode & 4) === 4) {
      this.api.addEventListener('selectionChanged', (e: any) => this.returnGridValue(e))
    }

    if ((update_mode & 8) === 8) {
      this.api.addEventListener('filterChanged', (e: any) => this.returnGridValue(e))
    }

    if ((update_mode & 16) === 16) {
      this.api.addEventListener('sortChanged', (e: any) => this.returnGridValue(e))
    }
  }

  private onGridReady(event: any) {
    this.api = event.api
    this.columnApi = event.columnApi

    this.set_update_mode()

  }

  private firstDataRendered(event: any) {
    if (this.props.args['fit_columns_on_grid_load']) {
      this.api.sizeColumnsToFit()
    }
    else {
      this.columnApi.autoSizeAllColumns()
    }
  }

  private date_formater(isoString: string, formaterString: string): String {
    let r = isoString
    if (isDate(isoString)) {
      r = format(parseISO(isoString), formaterString)
    }
    return r
  }

  private number_formater(number: number, precision: number): String {
    let r = ''
    if (number) {
      r = number.toFixed(precision)
    } else {
      r = number.toString()
    }
    return r
  }

  private returnGridValue(e: any) {
    var return_data: any[] = []
    let return_mode = this.props.args['data_return_mode']

    switch (return_mode) {
      case 0: //ALL_DATA
        this.api.forEachLeafNode((row) => return_data.push(row.data))
        break;

      case 1: //FILTERED_DATA
        this.api.forEachNodeAfterFilter((row) => { if (!row.group) { return_data.push(row.data) } })
        break;

      case 2: //FILTERED_SORTED_DATA
        this.api.forEachNodeAfterFilterAndSort((row) => { if (!row.group) { return_data.push(row.data) } })
        break;
    }

    var return_value = {
      original_dtypes: this.frame_dtypes,
      gridData: return_data,
      selectedRows: this.api.getSelectedRows()
    }

    Streamlit.setComponentValue(return_value)
  }

  private ManualUpdateButton(props: any) {

    if (props.manual_update) {
      return (<button onClick={props.onClick}>Save</button>)
    }
    else {
      return (<span></span>)
    }
  }

  public render = (): ReactNode => {

    const gridOptions = Object.assign({}, this.columnFormaters, this.gridOptions, { rowData: this.gridData })
    return (
      <div className="ag-theme-balham" style={{ height: this.props.args['height'], width: '100%' }}>
        <this.ManualUpdateButton manual_update={this.manual_update_requested} onClick={(e: any) => this.returnGridValue(e)} />
        <AgGridReact
          onGridReady={(e) => this.onGridReady(e)}
          onFirstDataRendered={(e) => this.firstDataRendered(e)}
          gridOptions={gridOptions}
        >
        </AgGridReact>
      </div >
    )
  }
}

// "withStreamlitConnection" is a wrapper function. It bootstraps the
// connection between your component and the Streamlit app, and handles
// passing arguments from Python -> Component.
//
// You don't need to edit withStreamlitConnection (but you're welcome to!).
export default withStreamlitConnection(AgGrid)