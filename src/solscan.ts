import axios from 'axios';

const BASE_URL = 'https://pro-api.solscan.io/v1.0';
const tokenMetadataCache: { [key: string]: any } = {};

async function fetchFromApi(endpoint: string) {
  const apiKey = process.env.SOLSCAN_API_KEY;
  if (!apiKey) {
    throw new Error('API key is not defined in the environment variables');
  }

  const url = `${BASE_URL}${endpoint}`;

  try {
    const response = await axios.get(url, {
      headers: {
        accept: '*/*',
        token: apiKey,
      },
    });
    return response.data;
  } catch (error) {
    throw new Error('Error fetching data');
  }
}

function transformTokenMetadata(data: any, tokenAddress: string) {
  return {
    name: data.name || '',
    symbol: data.symbol || '',
    icon: data.icon || '',
    decimals: data.decimals || 0,
    address: tokenAddress,
  };
}

export async function getTransaction(transactionId: string) {
  const endpoint = `/transaction/${transactionId}`;
  return await fetchFromApi(endpoint);
}

export async function getTokenMetadata(tokenAddress: string) {
  if (tokenMetadataCache[tokenAddress]) {
    return tokenMetadataCache[tokenAddress];
  }

  const endpoint = `/token/meta?tokenAddress=${tokenAddress}`;
  try {
    const data = await fetchFromApi(endpoint);
    const transformedData = transformTokenMetadata(data, tokenAddress);
    tokenMetadataCache[tokenAddress] = transformedData;
    return transformedData;
  } catch {
    const defaultData = transformTokenMetadata({}, tokenAddress);
    tokenMetadataCache[tokenAddress] = defaultData;
    return defaultData;
  }
}

export async function getMultipleTokenMetadata(tokenAddresses: string[]) {
  const requests = tokenAddresses.map(address => getTokenMetadata(address));
  return await Promise.all(requests);
}
