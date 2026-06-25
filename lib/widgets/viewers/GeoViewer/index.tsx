import * as turf from '@turf/turf'
import maplibregl, { LngLatBoundsLike } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef } from 'react'
import { parse } from 'wkt'
import { WidgetProps } from '../../widgets-context'

export default function GeoViewer({ term }: WidgetProps) {
  const ref = useRef(null)
  const map = useRef<maplibregl.Map>(null)

  useEffect(() => {
    if (!ref.current || map.current) return

    map.current = new maplibregl.Map({
      container: ref.current,
      maxZoom: 18,
      style: 'https://tiles.openfreemap.org/styles/bright'
    })

    if (term) {
      const geom = parse(term.value)
      const bbox = turf.bbox(geom)
      map.current.on('load', () => {
        map.current!.addSource('data', {
          type: 'geojson',
          data: geom
        })

        // Always add all style layers regardless of geometry type
        map.current!.addLayer({
          id: 'points',
          type: 'circle',
          source: 'data',
          paint: {
            'circle-radius': 6,
            'circle-color': '#007cbf',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#fff'
          }
        })
        map.current!.addLayer({
          id: 'lines',
          type: 'line',
          source: 'data',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#ff7e00',
            'line-width': 4
          }
        })
        map.current!.addLayer({
          id: 'polygons',
          type: 'fill',
          source: 'data',
          paint: {
            'fill-color': '#00ff7e',
            'fill-opacity': 0.4,
            'fill-outline-color': '#007cbf'
          }
        })

        map.current!.fitBounds(bbox as LngLatBoundsLike, {
          padding: 20,
          animate: false
        })
      })
    }
  }, [])

  return <div ref={ref}></div>
}
