import React, { useState, useEffect, useCallback, useMemo } from "react";
import PropTypes from "prop-types";
import { react2angular } from "react2angular";
import cx from "classnames";
import { has } from "lodash";

import EditInPlace from "@/components/EditInPlace";
import Parameters from "@/components/Parameters";
import TimeAgo from "@/components/TimeAgo";
import QueryControlDropdown from "@/components/EditVisualizationButton/QueryControlDropdown";
import EditVisualizationButton from "@/components/EditVisualizationButton";

import DataSource from "@/services/data-source";
import { Query } from "@/services/query";
import { $location, $rootScope } from "@/services/ng";
import { pluralize, durationHumanize } from "@/lib/utils";

import QueryPageHeader from "./components/QueryPageHeader";
import QueryVisualizationTabs from "./components/QueryVisualizationTabs";
import QueryExecutionStatus from "./components/QueryExecutionStatus";
import QueryMetadata from "./components/QueryMetadata";
import QueryViewButton from "./components/QueryViewButton";

import useVisualizationTabHandler from "./hooks/useVisualizationTabHandler";
import useQueryExecute from "./hooks/useQueryExecute";
import useUpdateQueryDescription from "./hooks/useUpdateQueryDescription";
import useQueryFlags from "./hooks/useQueryFlags";
import useQueryParameters from "./hooks/useQueryParameters";
import useAddToDashboardDialog from "./hooks/useAddToDashboardDialog";
import useEmbedDialog from "./hooks/useEmbedDialog";
import useEditScheduleDialog from "./hooks/useEditScheduleDialog";
import useEditVisualizationDialog from "./hooks/useEditVisualizationDialog";
import useDeleteVisualization from "./hooks/useDeleteVisualization";

import "./QueryView.less";
import useMedia from "use-media";

// ANGULAR_REMOVE_ME: Update with new Router
function updateUrlSearch(...params) {
  $location.search(...params);
  $rootScope.$applyAsync();
}

function useFullscreenHandler(available) {
  const [fullscreen, setFullscreen] = useState(has($location.search(), "fullscreen"));
  const toggleFullscreen = useCallback(() => setFullscreen(!fullscreen), [fullscreen]);

  useEffect(() => {
    updateUrlSearch("fullscreen", fullscreen ? true : null);
  }, [fullscreen]);

  return useMemo(() => [available && fullscreen, toggleFullscreen], [available, fullscreen, toggleFullscreen]);
}

function QueryView(props) {
  const [query, setQuery] = useState(props.query);
  const [dataSource, setDataSource] = useState();
  const queryFlags = useQueryFlags(query, dataSource);
  const [parameters, areParametersDirty, updateParametersDirtyFlag] = useQueryParameters(query);
  const [selectedVisualization, setSelectedVisualization] = useVisualizationTabHandler(query.visualizations);
  const isMobile = useMedia({ maxWidth: 768 });
  const [fullscreen, toggleFullscreen] = useFullscreenHandler(!isMobile);

  const {
    queryResult,
    queryResultData,
    isQueryExecuting,
    isExecutionCancelling,
    executeQuery,
    cancelExecution,
  } = useQueryExecute(query);

  const updateQueryDescription = useUpdateQueryDescription(query, setQuery);
  const openAddToDashboardDialog = useAddToDashboardDialog(query);
  const openEmbedDialog = useEmbedDialog(query);
  const editSchedule = useEditScheduleDialog(query, setQuery);
  const addVisualization = useEditVisualizationDialog(query, queryResult, (newQuery, visualization) => {
    setQuery(newQuery);
    setSelectedVisualization(visualization.id);
  });
  const editVisualization = useEditVisualizationDialog(query, queryResult, newQuery => setQuery(newQuery));
  const deleteVisualization = useDeleteVisualization(query, setQuery);

  const doExecuteQuery = useCallback(
    (skipParametersDirtyFlag = false) => {
      if (!queryFlags.canExecute || (!skipParametersDirtyFlag && areParametersDirty) || isQueryExecuting) {
        return;
      }
      executeQuery();
    },
    [areParametersDirty, executeQuery, isQueryExecuting, queryFlags.canExecute]
  );

  useEffect(() => {
    document.title = query.name;
  }, [query.name]);

  useEffect(() => {
    DataSource.get({ id: query.data_source_id }).then(setDataSource);
  }, [query.data_source_id]);

  return (
    <div className={cx("query-page-wrapper", { "query-view-fullscreen": fullscreen })}>
      <div className="container">
        <QueryPageHeader
          query={query}
          dataSource={dataSource}
          onChange={setQuery}
          selectedVisualization={selectedVisualization}
          headerExtra={
            <QueryViewButton
              className="m-r-5"
              type="primary"
              shortcut="mod+enter, alt+enter"
              disabled={!queryFlags.canExecute || isQueryExecuting || areParametersDirty}
              onClick={doExecuteQuery}>
              Refresh
            </QueryViewButton>
          }
        />
        {!fullscreen && (
          <div className="m-t-5 m-l-15 m-r-15">
            <EditInPlace
              className="w-100"
              value={query.description}
              isEditable={queryFlags.canEdit}
              onDone={updateQueryDescription}
              placeholder="Add description"
              ignoreBlanks={false}
              editorProps={{ autosize: { minRows: 2, maxRows: 4 } }}
              multiline
            />
          </div>
        )}
      </div>
      <div className="query-view-content">
        {!fullscreen && query.hasParameters() && (
          <div className="bg-white tiled p-15 m-t-15 m-l-15 m-r-15">
            <Parameters
              parameters={parameters}
              onValuesChange={() => {
                updateParametersDirtyFlag(false);
                doExecuteQuery(true);
              }}
              onPendingValuesChange={() => updateParametersDirtyFlag()}
            />
          </div>
        )}
        <div className="query-results m-t-15">
          {queryResult && queryResultData.status !== "done" && (
            <div className="query-alerts m-t-15 m-b-15">
              <QueryExecutionStatus
                status={queryResultData.status}
                updatedAt={queryResultData.updatedAt}
                error={queryResultData.error}
                isCancelling={isExecutionCancelling}
                onCancel={cancelExecution}
              />
            </div>
          )}
          {queryResultData.status === "done" && (
            <>
              <QueryVisualizationTabs
                queryResult={queryResult}
                visualizations={query.visualizations}
                showNewVisualizationButton={queryFlags.canEdit}
                canDeleteVisualizations={queryFlags.canEdit}
                selectedTab={selectedVisualization}
                onChangeTab={setSelectedVisualization}
                onAddVisualization={addVisualization}
                onDeleteVisualization={deleteVisualization}
                cardStyle
              />
              <div className="query-results-footer d-flex align-items-center">
                <span className="m-r-5">
                  <QueryControlDropdown
                    query={query}
                    queryResult={queryResult}
                    queryExecuting={isQueryExecuting}
                    showEmbedDialog={openEmbedDialog}
                    embed={false}
                    apiKey={query.api_key}
                    selectedTab={selectedVisualization}
                    openAddToDashboardForm={openAddToDashboardDialog}
                  />
                </span>
                <QueryViewButton
                  className="icon-button m-r-5 hidden-xs"
                  title="Toggle Fullscreen"
                  type={fullscreen ? "primary" : "default"}
                  shortcut="alt+f"
                  onClick={toggleFullscreen}>
                  <i className="zmdi zmdi-fullscreen" />
                </QueryViewButton>
                {queryFlags.canEdit && (
                  <EditVisualizationButton
                    openVisualizationEditor={editVisualization}
                    selectedTab={selectedVisualization}
                  />
                )}
                <span className="m-l-5">
                  <strong>{queryResultData.rows.length}</strong> {pluralize("row", queryResultData.rows.length)}
                </span>
                <span className="m-l-10">
                  <strong>{durationHumanize(queryResult.getRuntime())}</strong>
                  <span className="hidden-xs"> runtime</span>
                </span>
                <span className="flex-fill" />
                <span className="m-r-10 hidden-xs">
                  Refreshed{" "}
                  <strong>
                    <TimeAgo date={queryResult.query_result.retrieved_at} />
                  </strong>
                </span>
              </div>
            </>
          )}
        </div>
        {!fullscreen && (
          <div className="p-r-15 p-l-15 p-b-15">
            <QueryMetadata layout="horizontal" query={query} dataSource={dataSource} onEditSchedule={editSchedule} />
          </div>
        )}
      </div>
    </div>
  );
}

QueryView.propTypes = { query: PropTypes.object.isRequired }; // eslint-disable-line react/forbid-prop-types

export default function init(ngModule) {
  ngModule.component("pageQueryView", react2angular(QueryView));

  return {
    "/queries/:queryId": {
      template: '<page-query-view query="$resolve.query"></page-query-view>',
      reloadOnSearch: false,
      layout: "fixed",
      resolve: {
        query: $route => {
          "ngInject";

          return Query.get({ id: $route.current.params.queryId });
        },
      },
    },
  };
}

init.init = true;