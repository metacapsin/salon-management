import { Link as RouterLink } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Box, Button, Card, CardContent, Chip, List, ListItem, ListItemText, Typography } from '@mui/material'
import { getPlatformOverview } from '../../api/platformApi'
import QueryState from '../../components/QueryState'

const STAT_CARDS = [
  { key: 'total', label: 'Registered salons' },
  { key: 'active', label: 'Active' },
  { key: 'suspended', label: 'Suspended' },
  { key: 'published', label: 'Booking page published' },
  { key: 'newLast30Days', label: 'New in last 30 days' },
]

// Platform ka overview. Saari ginti server ke asli database se aati hai.
export default function AdminDashboard() {
  const query = useQuery({ queryKey: ['platform', 'overview'], queryFn: getPlatformOverview })
  const stats = query.data?.stats
  const recent = query.data?.recentSalons ?? []

  return (
    <Box sx={{ maxWidth: 1000 }}>
      <Typography variant="h4" component="h1" sx={{ fontWeight: 800, color: 'primary.main', mb: 2 }}>
        Platform overview
      </Typography>
      <QueryState query={query}>
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(5, 1fr)' }, mb: 3 }}>
          {STAT_CARDS.map((c) => (
            <Card key={c.key}>
              <CardContent>
                <Typography variant="h4" sx={{ fontWeight: 800 }}>
                  {stats?.[c.key] ?? 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {c.label}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Box>

        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6" component="h2">
                Recently registered salons
              </Typography>
              <Button component={RouterLink} to="/admin/salons">
                View all
              </Button>
            </Box>
            {recent.length === 0 ? (
              <Typography color="text.secondary" sx={{ mt: 1 }}>
                No salons have registered yet.
              </Typography>
            ) : (
              <List disablePadding>
                {recent.map((s) => (
                  <ListItem key={s.id} disableGutters secondaryAction={<Chip size="small" label={s.status} color={s.status === 'active' ? 'success' : 'warning'} />}>
                    <ListItemText
                      primary={<RouterLink to={`/admin/salons/${s.id}`}>{s.name}</RouterLink>}
                      secondary={`${s.city || 'City not set'} · ${new Date(s.createdAt).toLocaleDateString()}`}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </CardContent>
        </Card>
      </QueryState>
    </Box>
  )
}
