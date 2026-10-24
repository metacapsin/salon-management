import { Alert, Box, Button, CircularProgress } from '@mui/material'
import { friendlyError } from '../api/client'

// Har data screen ke 4 haal: loading, error (retry ke saath), khaali, aur data (SRS UX-02).
// Props: query = useQuery ka result, isEmpty = data khaali hai?, empty = khaali hone par kya dikhana hai.
export default function QueryState({ query, isEmpty, empty, children }) {
  if (query.isPending) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }} role="status" aria-label="Loading">
        <CircularProgress />
      </Box>
    )
  }
  if (query.isError) {
    const denied = query.error?.status === 403
    return (
      <Alert
        severity={denied ? 'warning' : 'error'}
        action={
          denied ? undefined : (
            <Button color="inherit" onClick={() => query.refetch()}>
              Try again
            </Button>
          )
        }
      >
        {friendlyError(query.error)}
      </Alert>
    )
  }
  if (isEmpty) return empty ?? <Alert severity="info">Nothing here yet.</Alert>
  return children
}
