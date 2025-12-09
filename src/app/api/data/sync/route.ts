import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { DataSyncService } from '@/services/dataSync'

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    if (!isAuthenticated(request)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const syncService = new DataSyncService();
    const result = await syncService.syncAllData();

    if (!result.success) {
        return NextResponse.json(
            { success: false, error: result.message, stats: result.stats },
            { status: 500 }
        );
    }

    return NextResponse.json({
      success: true,
      message: (result as any).message || 'Sync completed successfully',
      data: result
    })

  } catch (error) {
    console.error('Data sync error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error during data sync' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    if (!isAuthenticated(request)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Return sync status information
    return NextResponse.json({
      success: true,
      message: 'Data sync endpoint available. Use POST to trigger sync.',
      availableSyncTypes: ['full', 'live', 'supplemental']
    })

  } catch (error) {
    console.error('Sync status error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}