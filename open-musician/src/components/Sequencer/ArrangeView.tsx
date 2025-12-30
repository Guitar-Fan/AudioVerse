import { Box, Button, Group, Paper, ScrollArea, SegmentedControl, Slider, Stack, Text } from '@mantine/core'
import { useMemo } from 'react'
import { useProjectStore } from '../../store/projectStore'
import { TimelineRuler } from './TimelineRuler'
import { StepSequencer } from './StepSequencer'
import { ScoreEditor } from './ScoreEditor'

const BEATS_PER_MEASURE = 4
const BASE_BEAT_WIDTH = 24

export function ArrangeView() {
  const tracks = useProjectStore((state) => state.tracks.filter((track) => track.type !== 'master'))
  const clips = useProjectStore((state) => state.clips)
  const markers = useProjectStore((state) => state.markers)
  const zoom = useProjectStore((state) => state.zoom)
  const setZoom = useProjectStore((state) => state.setZoom)
  const selectedTrackId = useProjectStore((state) => state.selectedTrackId)
  const viewMode = useProjectStore((state) => state.viewMode)
  const setViewMode = useProjectStore((state) => state.setViewMode)
  const addClip = useProjectStore((state) => state.addClip)

  const beatWidth = BASE_BEAT_WIDTH * zoom
  const totalMeasures = useMemo(() => {
    if (!clips.length) return 8
    const furthestMeasure = Math.max(...clips.map((clip) => clip.start + clip.length))
    return Math.max(8, Math.ceil(furthestMeasure))
  }, [clips])

  const arrangementWidth = totalMeasures * BEATS_PER_MEASURE * beatWidth

  const selectedClip = useMemo(() => {
    if (!selectedTrackId) return undefined
    return clips
      .filter((clip) => clip.trackId === selectedTrackId)
      .sort((a, b) => a.start - b.start)[0]
  }, [clips, selectedTrackId])

  const handleAddClip = () => {
    if (!selectedTrackId) return
    const trackClips = clips.filter((clip) => clip.trackId === selectedTrackId)
    const lastEnd = trackClips.length ? Math.max(...trackClips.map((clip) => clip.start + clip.length)) : 0
    addClip({
      trackId: selectedTrackId,
      type: 'midi',
      name: 'New Idea',
      color: '#4ADE80',
      start: lastEnd,
      length: 2,
      loop: false,
      status: 'one-shot',
    })
  }

  return (
    <Paper withBorder p="md" radius="md" shadow="xs">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <Stack gap={0}>
            <Text size="sm" fw={600}>
              Arrangement
            </Text>
            <Text size="xs" c="dimmed">
              Zoom, drop markers, and sketch clips before diving into detailed editing.
            </Text>
          </Stack>
          <Group gap="md" align="center">
            <Stack gap={2} w={180}>
              <Group justify="space-between" align="center">
                <Text size="xs" c="dimmed">
                  Zoom
                </Text>
                <Text size="xs" fw={600}>
                  {zoom.toFixed(2)}x
                </Text>
              </Group>
              <Slider min={0.5} max={4} step={0.1} value={zoom} onChange={setZoom} />
            </Stack>
            <SegmentedControl
              value={viewMode}
              onChange={(mode) => setViewMode(mode as typeof viewMode)}
              data={[
                { label: 'Arrange', value: 'arrange' },
                { label: 'Steps', value: 'step' },
                { label: 'Score', value: 'score' },
              ]}
            />
            <Button variant="gradient" onClick={handleAddClip} disabled={!selectedTrackId}>
              Add Clip to Track
            </Button>
          </Group>
        </Group>

        <TimelineRuler totalMeasures={totalMeasures} beatWidth={beatWidth} markers={markers} />

        <ScrollArea h={300} type="auto">
          <Stack gap="xs" pr="sm">
            {tracks.map((track) => {
              const trackClips = clips
                .filter((clip) => clip.trackId === track.id)
                .sort((a, b) => a.start - b.start)
              return (
                <Box key={track.id} className="arrange-track">
                  <Box className="arrange-track-label">
                    <Text fw={600}>{track.name}</Text>
                    <Text size="xs" c="dimmed">
                      {track.type.toUpperCase()}
                    </Text>
                  </Box>
                  <Box className="arrange-track-lane" style={{ width: arrangementWidth }}>
                    {trackClips.length === 0 && (
                      <Text size="xs" c="dimmed">
                        Drop clips here to start building this section.
                      </Text>
                    )}
                    {trackClips.map((clip) => (
                      <Box
                        key={clip.id}
                        className="arrange-clip"
                        data-type={clip.type}
                        style={{
                          width: clip.length * BEATS_PER_MEASURE * beatWidth,
                          left: clip.start * BEATS_PER_MEASURE * beatWidth,
                          background: clip.color,
                        }}
                        title={`${clip.name} · ${clip.length} bars`}
                      >
                        <Text size="sm" fw={600}>
                          {clip.name}
                        </Text>
                        <Text size="xs">
                          {clip.length} bars · {clip.status === 'looping' ? 'Loop' : 'One Shot'}
                        </Text>
                      </Box>
                    ))}
                  </Box>
                </Box>
              )
            })}
          </Stack>
        </ScrollArea>

        {viewMode === 'step' && <StepSequencer stepData={selectedClip?.stepData} />}
        {viewMode === 'score' && <ScoreEditor notes={selectedClip?.notes} />}
      </Stack>
    </Paper>
  )
}
