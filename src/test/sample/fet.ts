// Define the expected response type
interface User {
  id: number;
  name: string;
  email: string;
}

async function fetchUserData(url: string): Promise<User[]> {
  try {
    const response = await globalThis.fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: User[] = await response.json();
    return data;
  } catch (error) {
    console.error("Fetch error:", error);
    throw error; // rethrow to handle upstream if needed
  }
}
