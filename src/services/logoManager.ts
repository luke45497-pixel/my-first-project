import { supabaseAdmin, TeamLogo } from '@/lib/supabase'

export interface LogoData {
  teamId: string
  logoUrl?: string
  logoStoragePath?: string
  initials: string
  primaryColor: string
  secondaryColor?: string
}

export class LogoManager {
  private readonly STORAGE_BUCKET = 'team-logos'
  private readonly DEFAULT_COLORS = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
    '#EC4899', '#14B8A6', '#F97316', '#06B6D4', '#84CC16'
  ]

  /**
   * Generate text-based logo using team initials
   */
  async generateTextLogo(teamName: string): Promise<{
    initials: string
    svgContent: string
    primaryColor: string
  }> {
    const initials = this.getTeamInitials(teamName)
    const primaryColor = this.getColorForTeam(teamName)

    // Generate SVG logo
    const svgContent = this.generateSVGLogo(initials, primaryColor)

    return {
      initials,
      svgContent,
      primaryColor
    }
  }

  /**
   * Get team initials from name
   */
  private getTeamInitials(teamName: string): string {
    return teamName
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('')
  }

  /**
   * Get consistent color for team based on name
   */
  private getColorForTeam(teamName: string): string {
    let hash = 0
    for (let i = 0; i < teamName.length; i++) {
      hash = teamName.charCodeAt(i) + ((hash << 5) - hash)
    }
    return this.DEFAULT_COLORS[Math.abs(hash) % this.DEFAULT_COLORS.length]
  }

  /**
   * Generate SVG logo content
   */
  private generateSVGLogo(initials: string, primaryColor: string): string {
    return `
      <svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
        <!-- Background circle -->
        <circle cx="32" cy="32" r="30" fill="${primaryColor}" />

        <!-- Inner circle for contrast -->
        <circle cx="32" cy="32" r="26" fill="${primaryColor}" opacity="0.9" />

        <!-- Text -->
        <text x="32" y="32"
              font-family="Arial, sans-serif"
              font-size="20"
              font-weight="bold"
              fill="white"
              text-anchor="middle"
              dominant-baseline="central">
          ${initials}
        </text>

        <!-- Optional subtle pattern -->
        <circle cx="32" cy="32" r="28" fill="none" stroke="white" stroke-width="0.5" opacity="0.3" />
      </svg>
    `.trim()
  }

  /**
   * Download and store team logo from external source
   */
  async downloadLogoFromSource(teamId: string, teamName: string): Promise<string | null> {
    try {
      // Try different sources for logos
      const sources = [
        `https://crests.football-data.org/${teamId}.svg`,
        `https://media.api-sports.io/football/teams/${teamId}.png`,
        `https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(teamName)}`
      ]

      for (const source of sources) {
        try {
          const logoUrl = await this.fetchLogoFromSource(source, teamName)
          if (logoUrl) {
            // Store in Supabase storage
            const storagePath = await this.storeLogoInStorage(teamId, logoUrl)
            if (storagePath) {
              // Save to database
              await this.saveLogoToDatabase(teamId, logoUrl, storagePath)
              return logoUrl
            }
          }
        } catch (error) {
          console.log(`Failed to fetch logo from ${source}:`, error)
          continue
        }
      }

      return null
    } catch (error) {
      console.error('Error downloading logo:', error)
      return null
    }
  }

  /**
   * Fetch logo from external source
   */
  private async fetchLogoFromSource(source: string, teamName: string): Promise<string | null> {
    try {
      const response = await fetch(source)

      if (!response.ok) {
        return null
      }

      // Handle different response types
      const contentType = response.headers.get('content-type')

      if (contentType?.includes('image')) {
        // It's an image URL, return the source
        return source
      } else if (contentType?.includes('svg')) {
        // It's an SVG, return the source
        return source
      } else if (contentType?.includes('json')) {
        // It's JSON, try to extract logo URL
        const data = await response.json()
        if (data.teams && data.teams.length > 0) {
          return data.teams[0].strTeamBadge || data.teams[0].strLogo
        }
      }

      return null
    } catch (error) {
      return null
    }
  }

  /**
   * Store logo in Supabase storage
   */
  private async storeLogoInStorage(teamId: string, logoUrl: string): Promise<string | null> {
    try {
      // Fetch the logo data
      const response = await fetch(logoUrl)
      if (!response.ok) {
        return null
      }

      const blob = await response.blob()
      const fileName = `team-${teamId}-${Date.now()}.png`
      const filePath = `${this.STORAGE_BUCKET}/${fileName}`

      // Upload to Supabase storage
      const { data, error } = await supabaseAdmin.storage
        .from(this.STORAGE_BUCKET)
        .upload(filePath, blob, {
          contentType: 'image/png',
          upsert: true
        })

      if (error) {
        console.error('Error uploading logo to storage:', error)
        return null
      }

      return filePath
    } catch (error) {
      console.error('Error storing logo:', error)
      return null
    }
  }

  /**
   * Save logo information to database
   */
  private async saveLogoToDatabase(
    teamId: string,
    logoUrl: string,
    storagePath: string
  ): Promise<boolean> {
    try {
      const { error } = await supabaseAdmin
        .from('team_logos')
        .upsert({
          team_id: teamId,
          logo_url: logoUrl,
          logo_storage_path: storagePath
        }, {
          onConflict: 'team_id'
        })

      return !error
    } catch (error) {
      console.error('Error saving logo to database:', error)
      return false
    }
  }

  /**
   * Get logo URL for a team
   */
  async getTeamLogo(teamId: string, teamName: string): Promise<{
    url?: string
    fallbackSvg?: string
    initials: string
    hasLogo: boolean
  }> {
    try {
      // Try to get from database first
      const { data: logoData, error } = await supabaseAdmin
        .from('team_logos')
        .select('*')
        .eq('team_id', teamId)
        .single()

      if (!error && logoData) {
        // Try to get public URL from storage
        if (logoData.logo_storage_path) {
          const { data } = supabaseAdmin.storage
            .from(this.STORAGE_BUCKET)
            .getPublicUrl(logoData.logo_storage_path)

          return {
            url: data.publicUrl,
            initials: this.getTeamInitials(teamName),
            hasLogo: true
          }
        }

        // Return the external URL if available
        if (logoData.logo_url) {
          return {
            url: logoData.logo_url,
            initials: this.getTeamInitials(teamName),
            hasLogo: true
          }
        }
      }

      // Generate fallback SVG logo
      const { initials, svgContent } = await this.generateTextLogo(teamName)

      return {
        fallbackSvg: svgContent,
        initials,
        hasLogo: false
      }
    } catch (error) {
      console.error('Error getting team logo:', error)

      // Generate fallback SVG logo on error
      const { initials, svgContent } = await this.generateTextLogo(teamName)

      return {
        fallbackSvg: svgContent,
        initials,
        hasLogo: false
      }
    }
  }

  /**
   * Get logo as data URL for client-side use
   */
  async getLogoAsDataUrl(teamId: string, teamName: string): Promise<string> {
    const logoData = await this.getTeamLogo(teamId, teamName)

    if (logoData.url) {
      return logoData.url
    }

    if (logoData.fallbackSvg) {
      // Convert SVG to data URL
      const svgBase64 = btoa(logoData.fallbackSvg)
      return `data:image/svg+xml;base64,${svgBase64}`
    }

    // Generate a basic colored square as ultimate fallback
    const color = this.getColorForTeam(teamName)
    const initials = this.getTeamInitials(teamName)
    const svg = `<svg width="64" height="64" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" fill="${color}"/><text x="32" y="32" font-family="Arial" font-size="20" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="central">${initials}</text></svg>`
    const svgBase64 = btoa(svg)
    return `data:image/svg+xml;base64,${svgBase64}`
  }

  /**
   * Generate multiple logo sizes for different use cases
   */
  async generateLogoSizes(teamName: string): Promise<{
    small: string
    medium: string
    large: string
  }> {
    const initials = this.getTeamInitials(teamName)
    const primaryColor = this.getColorForTeam(teamName)

    const generateSVG = (size: number) => `
      <svg width="${size}" height="${size}" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
        <circle cx="32" cy="32" r="30" fill="${primaryColor}" />
        <text x="32" y="32" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="central">${initials}</text>
      </svg>
    `

    return {
      small: `data:image/svg+xml;base64,${btoa(generateSVG(32))}`,
      medium: `data:image/svg+xml;base64,${btoa(generateSVG(64))}`,
      large: `data:image/svg+xml;base64,${btoa(generateSVG(128))}`
    }
  }

  /**
   * Batch process logos for multiple teams
   */
  async processTeamLogos(teams: Array<{ id: string; name: string }>): Promise<{
    processed: number
    failed: number
    errors: string[]
  }> {
    const results = {
      processed: 0,
      failed: 0,
      errors: [] as string[]
    }

    for (const team of teams) {
      try {
        // Try to download logo from external sources
        const logoUrl = await this.downloadLogoFromSource(team.id, team.name)

        if (logoUrl) {
          results.processed++
        } else {
          // Generate fallback logo and save to database
          const { initials, svgContent, primaryColor } = await this.generateTextLogo(team.name)

          const { error } = await supabaseAdmin
            .from('team_logos')
            .upsert({
              team_id: team.id,
              logo_url: null,
              logo_storage_path: null
            }, {
              onConflict: 'team_id'
            })

          if (!error) {
            results.processed++
          } else {
            results.failed++
            results.errors.push(`Failed to save logo for ${team.name}: ${error.message}`)
          }
        }
      } catch (error) {
        results.failed++
        results.errors.push(`Failed to process ${team.name}: ${error}`)
      }
    }

    return results
  }

  /**
   * Delete logo from storage and database
   */
  async deleteTeamLogo(teamId: string): Promise<boolean> {
    try {
      // Get logo data from database
      const { data: logoData } = await supabaseAdmin
        .from('team_logos')
        .select('logo_storage_path')
        .eq('team_id', teamId)
        .single()

      // Delete from storage if exists
      if (logoData?.logo_storage_path) {
        const { error: storageError } = await supabaseAdmin.storage
          .from(this.STORAGE_BUCKET)
          .remove([logoData.logo_storage_path])

        if (storageError) {
          console.error('Error deleting logo from storage:', storageError)
        }
      }

      // Delete from database
      const { error: dbError } = await supabaseAdmin
        .from('team_logos')
        .delete()
        .eq('team_id', teamId)

      return !dbError
    } catch (error) {
      console.error('Error deleting team logo:', error)
      return false
    }
  }
}