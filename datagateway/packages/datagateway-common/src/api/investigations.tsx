import React from 'react';
import axios, { AxiosError } from 'axios';
import { useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';
import { IndexRange } from 'react-virtualized';
import { fetchIds, getApiParams, parseSearchToQuery } from '.';
import handleICATError from '../handleICATError';
import { readSciGatewayToken } from '../parseTokens';
import {
  AdditionalFilters,
  FiltersType,
  Investigation,
  SortType,
} from '../app.types';
import { StateType } from '../state/app.types';
import {
  useQuery,
  UseQueryResult,
  useInfiniteQuery,
  UseInfiniteQueryResult,
  InfiniteData,
  useQueries,
  UseQueryOptions,
} from 'react-query';
import { fetchDatasetCountQuery } from './datasets';
import useDeepCompareEffect from 'use-deep-compare-effect';
import retryICATErrors from './retryICATErrors';

const fetchInvestigations = (
  apiUrl: string,
  sortAndFilters: {
    sort: SortType;
    filters: FiltersType;
  },
  additionalFilters?: AdditionalFilters,
  offsetParams?: IndexRange,
  ignoreIDSort?: boolean
): Promise<Investigation[]> => {
  const params = getApiParams(sortAndFilters, ignoreIDSort);

  if (offsetParams) {
    params.append('skip', JSON.stringify(offsetParams.startIndex));
    params.append(
      'limit',
      JSON.stringify(offsetParams.stopIndex - offsetParams.startIndex + 1)
    );
  }

  additionalFilters?.forEach((filter) => {
    params.append(filter.filterType, filter.filterValue);
  });

  return axios
    .get(`${apiUrl}/investigations`, {
      params,
      headers: {
        Authorization: `Bearer ${readSciGatewayToken().sessionId}`,
      },
    })
    .then((response) => {
      return response.data;
    });
};

export const useInvestigation = (
  investigationId: number,
  additionalFilters?: AdditionalFilters
): UseQueryResult<Investigation[], AxiosError> => {
  const apiUrl = useSelector((state: StateType) => state.dgcommon.urls.apiUrl);

  return useQuery<
    Investigation[],
    AxiosError,
    Investigation[],
    [string, number, AdditionalFilters?, boolean?]
  >(
    ['investigation', investigationId, additionalFilters],
    (params) => {
      return fetchInvestigations(apiUrl, { sort: {}, filters: {} }, [
        {
          filterType: 'where',
          filterValue: JSON.stringify({
            id: { eq: investigationId },
          }),
        },
        ...(additionalFilters ?? []),
      ]);
    },
    {
      onError: (error) => {
        handleICATError(error);
      },
      retry: retryICATErrors,
    }
  );
};

export const useInvestigationsPaginated = (
  additionalFilters?: AdditionalFilters,
  ignoreIDSort?: boolean
): UseQueryResult<Investigation[], AxiosError> => {
  const apiUrl = useSelector((state: StateType) => state.dgcommon.urls.apiUrl);
  const location = useLocation();
  const { filters, sort, page, results } = parseSearchToQuery(location.search);

  return useQuery<
    Investigation[],
    AxiosError,
    Investigation[],
    [
      string,
      {
        sort: SortType;
        filters: FiltersType;
        page: number;
        results: number;
      },
      AdditionalFilters?,
      boolean?
    ]
  >(
    [
      'investigation',
      { sort, filters, page: page ?? 1, results: results ?? 10 },
      additionalFilters,
      ignoreIDSort,
    ],
    (params) => {
      const { sort, filters, page, results } = params.queryKey[1];
      const startIndex = (page - 1) * results;
      const stopIndex = startIndex + results - 1;
      return fetchInvestigations(
        apiUrl,
        { sort, filters },
        additionalFilters,
        {
          startIndex,
          stopIndex,
        },
        ignoreIDSort
      );
    },
    {
      onError: (error) => {
        handleICATError(error);
      },
      retry: retryICATErrors,
    }
  );
};

export const useInvestigationsInfinite = (
  additionalFilters?: AdditionalFilters,
  ignoreIDSort?: boolean
): UseInfiniteQueryResult<Investigation[], AxiosError> => {
  const apiUrl = useSelector((state: StateType) => state.dgcommon.urls.apiUrl);
  const location = useLocation();
  const { filters, sort } = parseSearchToQuery(location.search);

  return useInfiniteQuery<
    Investigation[],
    AxiosError,
    Investigation[],
    [
      string,
      { sort: SortType; filters: FiltersType },
      AdditionalFilters?,
      boolean?
    ]
  >(
    ['investigation', { sort, filters }, additionalFilters, ignoreIDSort],
    (params) => {
      const { sort, filters } = params.queryKey[1];
      const offsetParams = params.pageParam ?? { startIndex: 0, stopIndex: 49 };
      return fetchInvestigations(
        apiUrl,
        { sort, filters },
        additionalFilters,
        offsetParams,
        ignoreIDSort
      );
    },
    {
      onError: (error) => {
        handleICATError(error);
      },
      retry: retryICATErrors,
    }
  );
};

const fetchInvestigationSize = (
  config: {
    facilityName: string;
    downloadApiUrl: string;
  },
  investigationId: number
): Promise<number> => {
  // Make use of the facility name and download API url for the request.
  const { facilityName, downloadApiUrl } = config;
  return axios
    .get(`${downloadApiUrl}/user/getSize`, {
      params: {
        sessionId: readSciGatewayToken().sessionId,
        facilityName: facilityName,
        entityType: 'investigation',
        entityId: investigationId,
      },
    })
    .then((response) => {
      return response.data;
    });
};

/**
 * For use with DLS button fetch size functionality
 * via using the refetch function returned by useQuery
 * Hence why the query is disabled by default
 */
export const useInvestigationSize = (
  investigationId: number
): UseQueryResult<number, AxiosError> => {
  const downloadApiUrl = useSelector(
    (state: StateType) => state.dgcommon.urls.downloadApiUrl
  );
  const facilityName = useSelector(
    (state: StateType) => state.dgcommon.facilityName
  );

  return useQuery<number, AxiosError, number, [string, number]>(
    ['investigationSize', investigationId],
    (params) =>
      fetchInvestigationSize(
        { facilityName, downloadApiUrl },
        params.queryKey[1]
      ),
    {
      onError: (error) => {
        handleICATError(error);
      },
      retry: retryICATErrors,
      enabled: false,
    }
  );
};

export const useInvestigationSizes = (
  data:
    | Investigation[]
    | InfiniteData<Investigation[]>
    | Investigation
    | undefined
): UseQueryResult<number, AxiosError>[] => {
  const downloadApiUrl = useSelector(
    (state: StateType) => state.dgcommon.urls.downloadApiUrl
  );
  const facilityName = useSelector(
    (state: StateType) => state.dgcommon.facilityName
  );

  const queryConfigs: UseQueryOptions<
    number,
    AxiosError,
    number,
    ['investigationSize', number]
  >[] = React.useMemo(() => {
    // check the type of the data parameter to determine the way the data needs to be iterated
    const aggregatedData = data
      ? 'pages' in data
        ? data.pages.flat()
        : data instanceof Array
        ? data
        : [data]
      : [];

    return aggregatedData.map((investigation) => {
      return {
        queryKey: ['investigationSize', investigation.id],
        queryFn: () =>
          fetchInvestigationSize(
            { facilityName, downloadApiUrl },
            investigation.id
          ),
        onError: (error) => {
          handleICATError(error, false);
        },
        retry: retryICATErrors,
        staleTime: Infinity,
      };
    });
  }, [data, facilityName, downloadApiUrl]);

  // useQueries doesn't allow us to specify type info, so ignore this line
  // since we strongly type the queries object anyway
  // we also need to prettier-ignore to make sure we don't wrap onto next line
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  // prettier-ignore
  const queries: UseQueryResult<number, AxiosError>[] = useQueries(queryConfigs);

  const [sizes, setSizes] = React.useState<
    UseQueryResult<number, AxiosError>[]
  >([]);

  const countAppliedRef = React.useRef(0);

  // when data changes (i.e. due to sorting or filtering) set the countAppliedRef
  // back to 0 so we can restart the process, as well as clear sizes
  React.useEffect(() => {
    countAppliedRef.current = 0;
    setSizes([]);
  }, [data]);

  // need to use useDeepCompareEffect here because the array returned by useQueries
  // is different every time this hook runs
  useDeepCompareEffect(() => {
    const currCountReturned = queries.reduce(
      (acc, curr) => acc + (curr.isFetched ? 1 : 0),
      0
    );
    const batchMax =
      sizes.length - currCountReturned < 5
        ? sizes.length - currCountReturned
        : 5;

    // this in effect batches our updates to only happen in batches >= 5
    if (currCountReturned - countAppliedRef.current >= batchMax) {
      setSizes(queries);
      countAppliedRef.current = currCountReturned;
    }
  }, [sizes, queries]);

  return sizes;
};

export const useInvestigationsDatasetCount = (
  data:
    | Investigation[]
    | InfiniteData<Investigation[]>
    | Investigation
    | undefined
): UseQueryResult<number, AxiosError>[] => {
  const apiUrl = useSelector((state: StateType) => state.dgcommon.urls.apiUrl);

  const queryConfigs: UseQueryOptions<
    number,
    AxiosError,
    number,
    ['investigationDatasetCount', number]
  >[] = React.useMemo(() => {
    // check the type of the data parameter to determine the way the data needs to be iterated
    const aggregatedData = data
      ? 'pages' in data
        ? data.pages.flat()
        : data instanceof Array
        ? data
        : [data]
      : [];

    return aggregatedData.map((investigation) => {
      return {
        queryKey: ['investigationDatasetCount', investigation.id],
        queryFn: () =>
          fetchDatasetCountQuery(apiUrl, {}, [
            {
              filterType: 'where',
              filterValue: JSON.stringify({
                'investigation.id': { eq: investigation.id },
              }),
            },
          ]),
        onError: (error) => {
          handleICATError(error, false);
        },
        retry: retryICATErrors,
        staleTime: Infinity,
      };
    });
  }, [data, apiUrl]);

  // useQueries doesn't allow us to specify type info, so ignore this line
  // since we strongly type the queries object anyway
  // we also need to prettier-ignore to make sure we don't wrap onto next line
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  // prettier-ignore
  const queries: UseQueryResult<number, AxiosError>[] = useQueries(queryConfigs);

  const [datasetCounts, setDatasetCounts] = React.useState<
    UseQueryResult<number, AxiosError>[]
  >([]);

  const countAppliedRef = React.useRef(0);

  // when data changes (i.e. due to sorting or filtering) set the countAppliedRef
  // back to 0 so we can restart the process, as well as clear datasetCounts
  React.useEffect(() => {
    countAppliedRef.current = 0;
    setDatasetCounts([]);
  }, [data]);

  // need to use useDeepCompareEffect here because the array returned by useQueries
  // is different every time this hook runs
  useDeepCompareEffect(() => {
    const currCountReturned = queries.reduce(
      (acc, curr) => acc + (curr.isFetched ? 1 : 0),
      0
    );
    const batchMax =
      datasetCounts.length - currCountReturned < 5
        ? datasetCounts.length - currCountReturned
        : 5;

    // this in effect batches our updates to only happen in batches >= 5
    if (currCountReturned - countAppliedRef.current >= batchMax) {
      setDatasetCounts(queries);
      countAppliedRef.current = currCountReturned;
    }
  }, [datasetCounts, queries]);

  return datasetCounts;
};

const fetchInvestigationCount = (
  apiUrl: string,
  filters: FiltersType,
  additionalFilters?: AdditionalFilters
): Promise<number> => {
  const params = getApiParams({ filters, sort: {} });
  params.delete('order');

  if (additionalFilters) {
    additionalFilters.forEach((filter) => {
      params.append(filter.filterType, filter.filterValue);
    });
  }

  return axios
    .get(`${apiUrl}/investigations/count`, {
      params,
      headers: {
        Authorization: `Bearer ${readSciGatewayToken().sessionId}`,
      },
    })
    .then((response) => response.data);
};

export const useInvestigationCount = (
  additionalFilters?: AdditionalFilters,
  storedFilters?: FiltersType,
  currentTab?: string
): UseQueryResult<number, AxiosError> => {
  const apiUrl = useSelector((state: StateType) => state.dgcommon.urls.apiUrl);
  const location = useLocation();
  const filters =
    currentTab === 'investigation' || !storedFilters
      ? parseSearchToQuery(location.search).filters
      : storedFilters;

  return useQuery<
    number,
    AxiosError,
    number,
    [string, string, { filters: FiltersType }, AdditionalFilters?]
  >(
    ['count', 'investigation', { filters }, additionalFilters],
    (params) => {
      const { filters } = params.queryKey[2];
      return fetchInvestigationCount(apiUrl, filters, additionalFilters);
    },
    {
      onError: (error) => {
        handleICATError(error);
      },
      retry: retryICATErrors,
    }
  );
};

const fetchInvestigationDetails = (
  apiUrl: string,
  investigationId: number
): Promise<Investigation> => {
  const params = new URLSearchParams();
  params.append('where', JSON.stringify({ id: { eq: investigationId } }));
  params.append(
    'include',
    JSON.stringify([{ investigationUsers: 'user' }, 'samples', 'publications'])
  );

  return axios
    .get(`${apiUrl}/investigations`, {
      params,
      headers: {
        Authorization: `Bearer ${readSciGatewayToken().sessionId}`,
      },
    })
    .then((response) => response.data[0]);
};

export const useInvestigationDetails = (
  investigationId: number
): UseQueryResult<Investigation, AxiosError> => {
  const apiUrl = useSelector((state: StateType) => state.dgcommon.urls.apiUrl);

  return useQuery<Investigation, AxiosError, Investigation, [string, number]>(
    ['investigationDetails', investigationId],
    (params) => fetchInvestigationDetails(apiUrl, params.queryKey[1]),
    {
      onError: (error) => {
        handleICATError(error);
      },
      retry: retryICATErrors,
    }
  );
};

const fetchISISInvestigations = (
  apiUrl: string,
  instrumentId: number,
  facilityCycleId: number,
  sortAndFilters: {
    sort: SortType;
    filters: FiltersType;
  },
  additionalFilters?: AdditionalFilters,
  offsetParams?: IndexRange
): Promise<Investigation[]> => {
  const params = getApiParams(sortAndFilters);

  if (offsetParams) {
    params.append('skip', JSON.stringify(offsetParams.startIndex));
    params.append(
      'limit',
      JSON.stringify(offsetParams.stopIndex - offsetParams.startIndex + 1)
    );
  }

  additionalFilters?.forEach((filter) => {
    params.append(filter.filterType, filter.filterValue);
  });

  return axios
    .get(
      `${apiUrl}/instruments/${instrumentId}/facilitycycles/${facilityCycleId}/investigations`,
      {
        params,
        headers: {
          Authorization: `Bearer ${readSciGatewayToken().sessionId}`,
        },
      }
    )
    .then((response) => {
      return response.data;
    });
};

export const useISISInvestigationsPaginated = (
  instrumentId: number,
  instrumentChildId: number,
  studyHierarchy: boolean
): UseQueryResult<Investigation[], AxiosError> => {
  const apiUrl = useSelector((state: StateType) => state.dgcommon.urls.apiUrl);
  const location = useLocation();
  const { filters, sort, page, results } = parseSearchToQuery(location.search);
  const queryKey = studyHierarchy
    ? 'ISISStudyInvestigation'
    : 'ISISFacilityCycleinvestigation';

  const includeFilter = {
    filterType: 'include',
    filterValue: JSON.stringify([
      {
        investigationInstruments: 'instrument',
      },
      {
        studyInvestigations: 'study',
      },
      {
        investigationUsers: 'user',
      },
    ]),
  };

  return useQuery<
    Investigation[],
    AxiosError,
    Investigation[],
    [
      string,
      number,
      number,
      {
        sort: SortType;
        filters: FiltersType;
        page: number;
        results: number;
      },
      AdditionalFilters?
    ]
  >(
    [
      queryKey,
      instrumentId,
      instrumentChildId,
      { sort, filters, page: page ?? 1, results: results ?? 10 },
    ],
    (params) => {
      const { sort, filters, page, results } = params.queryKey[3];
      const startIndex = (page - 1) * results;
      const stopIndex = startIndex + results - 1;
      if (studyHierarchy) {
        return fetchInvestigations(
          apiUrl,
          { sort, filters },
          [
            {
              filterType: 'where',
              filterValue: JSON.stringify({
                'investigationInstruments.instrument.id': { eq: instrumentId },
              }),
            },
            {
              filterType: 'where',
              filterValue: JSON.stringify({
                'studyInvestigations.study.id': { eq: instrumentChildId },
              }),
            },
            includeFilter,
          ],
          {
            startIndex,
            stopIndex,
          }
        );
      } else {
        return fetchISISInvestigations(
          apiUrl,
          instrumentId,
          instrumentChildId,
          { sort, filters },
          [includeFilter],
          {
            startIndex,
            stopIndex,
          }
        );
      }
    },
    {
      onError: (error) => {
        handleICATError(error);
      },
      retry: retryICATErrors,
    }
  );
};

export const useISISInvestigationsInfinite = (
  instrumentId: number,
  instrumentChildId: number,
  studyHierarchy: boolean
): UseInfiniteQueryResult<Investigation[], AxiosError> => {
  const apiUrl = useSelector((state: StateType) => state.dgcommon.urls.apiUrl);
  const location = useLocation();
  const { filters, sort } = parseSearchToQuery(location.search);
  const queryKey = studyHierarchy
    ? 'ISISStudyInvestigation'
    : 'ISISFacilityCycleinvestigation';

  const includeFilter = {
    filterType: 'include',
    filterValue: JSON.stringify([
      {
        investigationInstruments: 'instrument',
      },
      {
        studyInvestigations: 'study',
      },
      {
        investigationUsers: 'user',
      },
    ]),
  };

  return useInfiniteQuery<
    Investigation[],
    AxiosError,
    Investigation[],
    [string, number, number, { sort: SortType; filters: FiltersType }]
  >(
    [queryKey, instrumentId, instrumentChildId, { sort, filters }],
    (params) => {
      const { sort, filters } = params.queryKey[3];
      const offsetParams = params.pageParam ?? { startIndex: 0, stopIndex: 49 };
      if (studyHierarchy) {
        return fetchInvestigations(
          apiUrl,
          { sort, filters },
          [
            {
              filterType: 'where',
              filterValue: JSON.stringify({
                'investigationInstruments.instrument.id': { eq: instrumentId },
              }),
            },
            {
              filterType: 'where',
              filterValue: JSON.stringify({
                'studyInvestigations.study.id': { eq: instrumentChildId },
              }),
            },
            includeFilter,
          ],
          offsetParams
        );
      } else {
        return fetchISISInvestigations(
          apiUrl,
          instrumentId,
          instrumentChildId,
          { sort, filters },
          [includeFilter],
          offsetParams
        );
      }
    },
    {
      onError: (error) => {
        handleICATError(error);
      },
      retry: retryICATErrors,
    }
  );
};

const fetchISISInvestigationCount = (
  apiUrl: string,
  instrumentId: number,
  facilityCycleId: number,
  filters: FiltersType
): Promise<number> => {
  const params = getApiParams({ filters, sort: {} });
  params.delete('order');

  return axios
    .get(
      `${apiUrl}/instruments/${instrumentId}/facilitycycles/${facilityCycleId}/investigations/count`,
      {
        params,
        headers: {
          Authorization: `Bearer ${readSciGatewayToken().sessionId}`,
        },
      }
    )
    .then((response) => {
      return response.data;
    });
};

export const useISISInvestigationCount = (
  instrumentId: number,
  instrumentChildId: number,
  studyHierarchy: boolean
): UseQueryResult<number, AxiosError> => {
  const apiUrl = useSelector((state: StateType) => state.dgcommon.urls.apiUrl);
  const location = useLocation();
  const { filters } = parseSearchToQuery(location.search);
  const queryKey = studyHierarchy
    ? 'ISISStudyInvestigation'
    : 'ISISFacilityCycleinvestigation';

  return useQuery<
    number,
    AxiosError,
    number,
    [string, string, number, number, { filters: FiltersType }]
  >(
    ['count', queryKey, instrumentId, instrumentChildId, { filters }],
    (params) => {
      const { filters } = params.queryKey[4];
      if (studyHierarchy) {
        return fetchInvestigationCount(apiUrl, filters, [
          {
            filterType: 'where',
            filterValue: JSON.stringify({
              'investigationInstruments.instrument.id': { eq: instrumentId },
            }),
          },
          {
            filterType: 'where',
            filterValue: JSON.stringify({
              'studyInvestigations.study.id': { eq: instrumentChildId },
            }),
          },
        ]);
      } else {
        return fetchISISInvestigationCount(
          apiUrl,
          instrumentId,
          instrumentChildId,
          filters
        );
      }
    },
    {
      onError: (error) => {
        handleICATError(error);
      },
      retry: retryICATErrors,
    }
  );
};

const fetchAllISISInvestigationIds = (
  apiUrl: string,
  instrumentId: number,
  facilityCycleId: number,
  filters: FiltersType
): Promise<number[]> => {
  const params = getApiParams({ filters, sort: {} });

  // TODO: currently datagateway-api can't apply distinct filter to ISIS queries,
  // so for now just retrieve everything
  // params.set('distinct', JSON.stringify('id'));

  return axios
    .get<Investigation[]>(
      `${apiUrl}/instruments/${instrumentId}/facilitycycles/${facilityCycleId}/investigations`,
      {
        params,
        headers: {
          Authorization: `Bearer ${readSciGatewayToken().sessionId}`,
        },
      }
    )
    .then((response) => {
      return response.data.map((x) => x.id);
    });
};

export const useISISInvestigationIds = (
  instrumentId: number,
  instrumentChildId: number,
  studyHierarchy: boolean,
  enabled = true
): UseQueryResult<number[], AxiosError> => {
  const apiUrl = useSelector((state: StateType) => state.dgcommon.urls.apiUrl);
  const location = useLocation();
  const { filters } = parseSearchToQuery(location.search);
  const queryKey = studyHierarchy
    ? 'ISISStudyInvestigationIds'
    : 'ISISFacilityCycleinvestigationIds';

  return useQuery<
    number[],
    AxiosError,
    number[],
    [string, number, number, { filters: FiltersType }]
  >(
    [queryKey, instrumentId, instrumentChildId, { filters }],
    (params) => {
      const { filters } = params.queryKey[3];
      if (studyHierarchy) {
        return fetchIds(apiUrl, 'investigation', filters, [
          {
            filterType: 'where',
            filterValue: JSON.stringify({
              'investigationInstruments.instrument.id': { eq: instrumentId },
            }),
          },
          {
            filterType: 'where',
            filterValue: JSON.stringify({
              'studyInvestigations.study.id': { eq: instrumentChildId },
            }),
          },
        ]);
      } else {
        return fetchAllISISInvestigationIds(
          apiUrl,
          instrumentId,
          instrumentChildId,
          filters
        );
      }
    },
    {
      onError: (error) => {
        handleICATError(error);
      },
      retry: retryICATErrors,
      enabled,
    }
  );
};

export const downloadInvestigation = (
  idsUrl: string,
  investigationId: number,
  investigationName: string
): void => {
  const params = {
    sessionId: readSciGatewayToken().sessionId,
    investigationIds: investigationId,
    compress: false,
    zip: true,
    outname: investigationName,
  };

  const link = document.createElement('a');
  link.href = `${idsUrl}/getData?${Object.entries(params)
    .map(([key, value]) => `${key}=${value}`)
    .join('&')}`;

  link.style.display = 'none';
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  link.remove();
};
