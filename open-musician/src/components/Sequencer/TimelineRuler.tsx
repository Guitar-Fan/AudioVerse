import { Box, Text } from '@mantine/core'
import type { TimelineMarker } from '../../store/projectStore'

const BEATS_PER_MEASURE = 4

interface TimelineRulerProps {
  totalMeasures: number
  beatWidth: number
  markers: TimelineMarker[]
}

export function TimelineRuler({ totalMeasures, beatWidth, markers }: TimelineRulerProps) {
  const measureWidth = beatWidth * BEATS_PER_MEASURE
  const measures = Array.from({ length: totalMeasures }, (_, index) => index)

  return (
    <Box className="timeline-wrapper">
      <Box className="timeline-ruler" style={{ width: measureWidth * totalMeasures }}>
        {measures.map((measureIndex) => (
          <Box key={`measure-${measureIndex}`} className="timeline-measure" style={{ width: measureWidth }}>
            <Text size="10px" fw={600} c="dimmed">
              Bar {measureIndex + 1}
            </Text>
            <Box className="timeline-grid">
              {Array.from({ length: BEATS_PER_MEASURE }, (_, beatIndex) => (
                <span
                  key={`beat-${measureIndex}-${beatIndex}`}
                  className="timeline-beat"
                  data-strong={beatIndex === 0}
                />
              ))}
            </Box>
          </Box>
        ))}
        {markers.map((marker) => (
          <Box
            key={marker.id}
            className="timeline-marker"
            style={{ left: marker.position * measureWidth }}
            title={`Marker @ bar ${marker.position + 1}`}
          >
            <Text size="10px" fw={600}>
              {marker.label}
            </Text>
          </Box>
        ))}
      </Box>
    </Box>
  )
}
